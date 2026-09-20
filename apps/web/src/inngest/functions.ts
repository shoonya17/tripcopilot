import { inngest } from './client';
import { processIngestion } from '@/lib/domain/ingestion';
import { generateBriefing } from '@/lib/domain/briefing';
import { db } from '@/lib/db';
import { emitNotification } from '@/lib/notifications';
import { deleteSource } from '@/lib/storage';
import { recordEvent } from '@/lib/events';
import { advanceTripLifecycle } from '@/lib/domain/trips';

async function tripLocalParts(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(date)
    .reduce(
      (a, p) => (a[p.type] = p.value, a),
      {} as Record<string, string>,
    );
}

export const processIngestionFunction = inngest.createFunction(
  {
    id: 'process-ingestion',
    retries: 3,
    triggers: [{ event: 'tripcopilot/ingestion.received' }],
  },
  async ({
    event,
  }: {
    event: { data: { ingestionId: string; tenantId: string } };
  }) => processIngestion(event.data.ingestionId, event.data.tenantId),
);

export const tripLifecycleSweep = inngest.createFunction(
  {
    id: 'trip-lifecycle-sweep',
    retries: 2,
    triggers: [{ cron: '15 * * * *' }],
  },
  async () => advanceTripLifecycle(new Date()),
);

export const briefingSweep = inngest.createFunction(
  {
    id: 'briefing-sweep',
    retries: 2,
    triggers: [{ cron: '0 * * * *' }],
  },
  async () => {
    const trips = await db.trip.findMany({
      where: { status: 'ACTIVE' },
      include: { owner: true },
    });

    const now = new Date();
    let generated = 0;

    for (const trip of trips) {
      const tz = trip.owner.defaultTimezone ?? trip.startTimezone ?? 'UTC';
      const local = await tripLocalParts(now, tz);
      const hour = Number(local.hour);

      if (hour === 8 || hour === 19) {
        const kind = hour === 8 ? 'morning' : 'evening';

        const briefing = await generateBriefing(
          trip.tripId,
          trip.tenantId,
          now,
          kind,
        );

        await emitNotification({
          tenantId: trip.tenantId,
          tripId: trip.tripId,
          category: 'BRIEFING',
          channel: 'IN_APP',
          deliveryKey: `${trip.tripId}:${local.year}-${local.month}-${local.day}:${kind}:IN_APP`,
          briefingGenerationId: briefing.briefingGenerationId,
          payload: briefing.content,
        });

        generated++;
      }
    }

    return { generated };
  },
);

export const preTripBriefingSweep = inngest.createFunction(
  {
    id: 'pretrip-briefing-sweep',
    retries: 2,
    triggers: [{ cron: '0 * * * *' }],
  },
  async () => {
    const trips = await db.trip.findMany({
      where: {
        status: 'PLANNED',
        startAt: { not: null },
      },
      include: { owner: true },
    });

    const now = Date.now();
    let generated = 0;

    for (const trip of trips) {
      if (!trip.startAt) continue;

      const hours = (trip.startAt.getTime() - now) / 3600000;

      if (hours < 23 || hours > 25) continue;

      const briefing = await generateBriefing(
        trip.tripId,
        trip.tenantId,
        trip.startAt,
        'pretrip_t24',
      );

      const tz = trip.owner.defaultTimezone ?? trip.startTimezone ?? 'UTC';
      const local = await tripLocalParts(trip.startAt, tz);

      await emitNotification({
        tenantId: trip.tenantId,
        tripId: trip.tripId,
        category: 'BRIEFING',
        channel: 'IN_APP',
        deliveryKey: `${trip.tripId}:${local.year}-${local.month}-${local.day}:pretrip_t24:IN_APP`,
        briefingGenerationId: briefing.briefingGenerationId,
        payload: briefing.content,
      });

      generated++;
    }

    return { generated };
  },
);

export const retentionSweep = inngest.createFunction(
  {
    id: 'retention-sweep',
    retries: 2,
    triggers: [{ cron: '30 2 * * *' }],
  },
  async () => {
    const docs = await db.document.findMany({
      where: {
        legalHold: false,
        retentionState: {
          in: ['ACTIVE', 'PENDING_DELETION'],
        },
      },
      include: { trip: true },
    });

    const now = Date.now();
    let prompted = 0;
    let purged = 0;

    for (const doc of docs) {
      if (!doc.trip?.endAt) continue;

      const days =
        (now - doc.trip.endAt.getTime()) / (24 * 3600 * 1000);

      if (days >= 30 && doc.retentionState === 'ACTIVE') {
        const exists = await db.eventLog.findFirst({
          where: {
            tenantId: doc.tenantId,
            tripId: doc.tripId!,
            eventName: 'DOCUMENT_DELETION_PROMPTED',
            payload: {
              path: ['documentId'],
              equals: doc.documentId,
            },
          } as any,
        });

        if (!exists) {
          await db.$transaction(async (tx) => {
            await tx.document.update({
              where: { documentId: doc.documentId },
              data: {
                retentionState: 'PENDING_DELETION',
                rowVersion: { increment: 1 },
              },
            });

            await recordEvent(tx, {
              tenantId: doc.tenantId,
              tripId: doc.tripId!,
              eventName: 'DOCUMENT_DELETION_PROMPTED',
              actorType: 'SYSTEM',
              payload: {
                documentId: doc.documentId,
              },
            });
          });

          prompted++;
        }
      } else if (
        days >= 37 &&
        doc.retentionState === 'PENDING_DELETION'
      ) {
        if (doc.storageObjectKey) {
          await deleteSource(doc.storageObjectKey);
        }

        await db.$transaction(async (tx) => {
          await tx.document.update({
            where: { documentId: doc.documentId },
            data: {
              retentionState: 'DELETED',
              rowVersion: { increment: 1 },
            },
          });

          await recordEvent(tx, {
            tenantId: doc.tenantId,
            tripId: doc.tripId!,
            eventName: 'DOCUMENT_DELETED',
            actorType: 'SYSTEM',
            payload: {
              documentId: doc.documentId,
            },
          });
        });

        purged++;
      }
    }

    return { prompted, purged };
  },
);

export const outboxPublisher = inngest.createFunction(
  {
    id: 'outbox-publisher',
    retries: 2,
    triggers: [{ cron: '* * * * *' }],
  },
  async () => {
    const batch = await db.outboxEvent.findMany({
      where: {
        publishedAt: null,
        availableAt: { lte: new Date() },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 100,
    });

    let published = 0;

    for (const row of batch) {
      try {
        await inngest.send({
          name: `tripcopilot/domain.${row.eventName.toLowerCase()}`,
          data: {
            tenantId: row.tenantId,
            ...((row.payload as any) ?? {}),
          },
        });

        await db.outboxEvent.update({
          where: {
            outboxId: row.outboxId,
          },
          data: {
            publishedAt: new Date(),
            attemptCount: {
              increment: 1,
            },
            lastError: null,
          },
        });

        published++;
      } catch (e) {
        await db.outboxEvent.update({
          where: {
            outboxId: row.outboxId,
          },
          data: {
            attemptCount: {
              increment: 1,
            },
            lastError:
              e instanceof Error
                ? e.message
                : 'publish failed',
          },
        });
      }
    }

    return {
      published,
      attempted: batch.length,
    };
  },
);