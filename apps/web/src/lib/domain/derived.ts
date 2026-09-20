import { db } from '../db';
import { recordEvent } from '../events';
import type { Prisma } from '@prisma/client';

function clean(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function gapMinutes(a: Date | null, b: Date | null) {
  if (!a || !b) return null;
  return (b.getTime() - a.getTime()) / 60000;
}

export async function recomputeTripDerivedState(
  tripId: string,
  tenantId: string,
) {
  const [segments, budgets, expenses, documents] = await Promise.all([
    db.segment.findMany({
      where: { tripId, tenantId },
      orderBy: { departureUtc: 'asc' },
    }),
    db.budget.findMany({
      where: { tripId, tenantId },
    }),
    db.expense.findMany({
      where: { tripId, tenantId },
    }),
    db.document.findMany({
      where: { tripId, tenantId },
    }),
  ]);

  const conflicts: Array<{
    type: string;
    entityType?: string;
    entityId?: string;
    summary: string;
    details: unknown;
    suppressionKey: string;
  }> = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i];
    const next = segments[i + 1];

    if (
      current.arrivalUtc &&
      next.departureUtc &&
      next.departureUtc.getTime() < current.arrivalUtc.getTime()
    ) {
      conflicts.push({
        type: 'TIME',
        entityType: 'SEGMENT',
        entityId: next.segmentId,
        summary: 'Two consecutive travel segments overlap in time.',
        details: {
          previousSegmentId: current.segmentId,
          nextSegmentId: next.segmentId,
          previousArrival: current.arrivalUtc,
          nextDeparture: next.departureUtc,
        },
        suppressionKey: `TIME:${current.segmentId}:${next.segmentId}`,
      });
    }

    const from = clean(current.arrivalLocation);
    const to = clean(next.departureLocation);

    if (from && to && from !== to) {
      conflicts.push({
        type: 'LOCATION',
        entityType: 'SEGMENT',
        entityId: next.segmentId,
        summary:
          'The next segment departs from a different location than the previous segment arrives at.',
        details: {
          previousArrival: current.arrivalLocation,
          nextDeparture: next.departureLocation,
          gapMinutes: gapMinutes(
            current.arrivalUtc,
            next.departureUtc,
          ),
        },
        suppressionKey: `LOCATION:${current.segmentId}:${next.segmentId}:${from}:${to}`,
      });
    }
  }

  if (budgets.length && expenses.length) {
    const budgetTotal = budgets.reduce(
      (sum, b) => sum + Number(b.plannedAmount),
      0,
    );

    const expenseTotal = expenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0,
    );

    if (budgetTotal > 0 && expenseTotal > budgetTotal) {
      conflicts.push({
        type: 'BUDGET',
        summary:
          'Recorded trip expenses exceed the planned budget total.',
        details: {
          budgetTotal,
          expenseTotal,
          overBy: expenseTotal - budgetTotal,
        },
        suppressionKey: `BUDGET:${budgetTotal.toFixed(4)}:${expenseTotal.toFixed(4)}`,
      });
    }
  }

  if (documents.length > 1) {
    const byBooking = new Map<
      string,
      typeof documents
    >();

    for (const doc of documents) {
      if (!doc.bookingReference || !doc.supplierName) continue;

      const key = `${clean(doc.supplierName)}:${clean(
        doc.bookingReference,
      )}`;

      const arr = byBooking.get(key) ?? [];
      arr.push(doc);
      byBooking.set(key, arr);
    }

    for (const [key, docs] of byBooking) {
      const hashes = new Set(docs.map((d) => d.contentHash));

      if (hashes.size > 1) {
        conflicts.push({
          type: 'DOCUMENT',
          entityType: 'DOCUMENT',
          entityId: docs[0].documentId,
          summary:
            'Multiple source documents share a booking reference but contain different source evidence.',
          details: {
            bookingKey: key,
            documentIds: docs.map((d) => d.documentId),
          },
          suppressionKey: `DOCUMENT:${key}:${[
            ...hashes,
          ]
            .sort()
            .join(',')}`,
        });
      }
    }
  }

  return db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const activeKeys = new Set(
        conflicts.map((c) => c.suppressionKey),
      );

      const existing = await tx.conflict.findMany({
        where: { tenantId, tripId },
      });

      for (const conflict of conflicts) {
        const current = existing.find(
          (x) => x.suppressionKey === conflict.suppressionKey,
        );

        if (current) {
          if (
            current.status === 'RESOLVED' &&
            !activeKeys.has(current.suppressionKey ?? '')
          ) {
            continue;
          }

          if (current.status === 'RESOLVED') {
            continue;
          }

          continue;
        }

        const created = await tx.conflict.create({
          data: {
            tenantId,
            tripId,
            conflictType: conflict.type,
            status: 'DETECTED',
            entityType: conflict.entityType,
            entityId: conflict.entityId,
            description: conflict.summary,
            evidence: conflict.details as Prisma.InputJsonValue,
            summary: conflict.summary,
            details: conflict.details as any,
            detectedAt: new Date(),
            suppressionKey: conflict.suppressionKey,
          },
        });

        await recordEvent(tx, {
          tenantId,
          tripId,
          eventName: 'CONFLICT_DETECTED',
          actorType: 'SYSTEM',
          payload: {
            conflictId: created.conflictId,
            conflictType: conflict.type,
            suppressionKey: conflict.suppressionKey,
          },
        });
      }

      return tx.conflict.findMany({
        where: { tenantId, tripId },
        orderBy: { createdAt: 'desc' },
      });
    },
  );
}

export async function ensureConnections(
  tripId: string,
  tenantId: string,
) {
  const segments = await db.segment.findMany({
    where: { tripId, tenantId },
    orderBy: { departureUtc: 'asc' },
  });

  return db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const desired = new Set<string>();

      for (let i = 0; i < segments.length - 1; i++) {
        const from = segments[i];
        const to = segments[i + 1];

        const key = `${from.segmentId}:${to.segmentId}`;
        desired.add(key);

        const gap = gapMinutes(
          from.arrivalUtc,
          to.departureUtc,
        );

        const existing = await tx.connection.findFirst({
          where: {
            tenantId,
            tripId,
            fromSegmentId: from.segmentId,
            toSegmentId: to.segmentId,
          },
        });

        if (existing) continue;

        if (
          gap !== null &&
          gap >= 0 &&
          gap <= 24 * 60
        ) {
          const connection = await tx.connection.create({
            data: {
              tenantId,
              tripId,
              fromSegmentId: from.segmentId,
              toSegmentId: to.segmentId,
              connectionType: 'TRAVEL_CONTINUITY',
              isInferred: true,
              confidence: 0.98,
            },
          });

          await recordEvent(tx, {
            tenantId,
            tripId,
            eventName: 'CONNECTION_INFERRED',
            actorType: 'SYSTEM',
            payload: {
              connectionId: connection.connectionId,
              fromSegmentId: from.segmentId,
              toSegmentId: to.segmentId,
              gapMinutes: gap,
            },
          });
        }
      }

      const existing = await tx.connection.findMany({
        where: { tenantId, tripId },
      });

      const stale = existing.filter(
        (c) =>
          !desired.has(
            `${c.fromSegmentId}:${c.toSegmentId}`,
          ),
      );

      for (const row of stale) {
        await tx.connection.delete({
          where: { connectionId: row.connectionId },
        });
      }

      return tx.connection.findMany({
        where: { tenantId, tripId },
        orderBy: { createdAt: 'asc' },
      });
    },
  );
}

export async function recomputeTripRelations(
  tripId: string,
  tenantId: string,
) {
  await ensureConnections(tripId, tenantId);
  return recomputeTripDerivedState(tripId, tenantId);
}
