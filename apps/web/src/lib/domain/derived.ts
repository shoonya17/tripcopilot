import { db } from '../db';
import { recordEvent } from '../events';
import type { Prisma } from '@prisma/client';

// Words that describe a type of place, not the place itself. Used to
// decide whether two location strings refer to the same city.
const STOPWORDS = new Set([
  'airport', 'station', 'terminal', 'junction', 'hotel', 'bus',
  'railway', 'road', 'street', 'avenue', 'stop', 'stand', 'gate',
  'square', 'park', 'city', 'central', 'centraal', 'international',
  'platform', 'terminal', 'depot', 'port', 'harbour', 'harbor',
]);

// Segment types that represent physical travel. HOTEL and ACTIVITY do not —
// they are stays, not transfers. The location mismatch check should ignore them.
const TRANSPORT_TYPES = new Set([
  'FLIGHT', 'TRAIN', 'BUS', 'FERRY', 'CAR',
]);

function clean(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function gapMinutes(a: Date | null, b: Date | null) {
  if (!a || !b) return null;
  return (b.getTime() - a.getTime()) / 60000;
}

function isTransport(segmentType: string | null | undefined): boolean {
  return TRANSPORT_TYPES.has((segmentType ?? '').toUpperCase());
}

/**
 * Returns true if two location strings likely refer to the same city or
 * locality. Splits on punctuation and whitespace, drops common type words
 * ("airport", "station", ...), then checks for any shared non-stopword.
 *
 * Examples:
 *   "Mumbai Airport"      vs "Taj Hotel, Colaba, Mumbai" → true
 *   "Delhi Airport"       vs "Mumbai Airport"             → false
 *   "Gurugram (gurgaon)"  vs "Kota (rajasthan)"           → false
 */
function shareLocality(a: string, b: string): boolean {
  const wordsA = a
    .split(/[,\s()\-]+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));
  const wordsB = b
    .split(/[,\s()\-]+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));

  if (wordsA.length === 0 || wordsB.length === 0) {
    // Not enough signal to compare — fall back to exact string equality
    return a === b;
  }

  return wordsA.some(w => wordsB.includes(w));
}

/**
 * Minimum comfortable transfer time, in minutes, between two consecutive
 * transport segments. Below this threshold, we flag CONNECTION_TIGHT.
 */
function tightThreshold(prevType: string, nextType: string): number {
  const p = prevType.toUpperCase();
  const n = nextType.toUpperCase();

  if (p === 'FLIGHT' && n === 'FLIGHT') return 90;   // airport to airport
  if (p === 'FLIGHT' || n === 'FLIGHT') return 120;  // airport to/from ground
  if (p === 'TRAIN' && n === 'TRAIN') return 30;     // same station typically
  if (p === 'BUS' && n === 'BUS') return 30;
  return 60;                                          // default
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

    const currentIsTransport = isTransport(current.segmentType);
    const nextIsTransport = isTransport(next.segmentType);

    // 1. Time overlap — real, always fires
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
        suppressionKey: `TIME:${current.segmentId}:${next.segmentId}:${current.arrivalUtc.toISOString()}:${next.departureUtc.toISOString()}`,
      });
    }

    // 2. Location mismatch — only when both segments are actual travel.
    //    HOTEL and ACTIVITY segments are stays, not transfers; comparing
    //    their location to an airport produces false positives.
    if (currentIsTransport && nextIsTransport) {
      const from = clean(current.arrivalLocation);
      const to = clean(next.departureLocation);

      if (from && to && !shareLocality(from, to)) {
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

      // 3. Tight connection — gap is non-negative but below the type-aware
      //    threshold. Fires only between transport segments.
      const gap = gapMinutes(current.arrivalUtc, next.departureUtc);
      if (gap !== null && gap >= 0) {
        const threshold = tightThreshold(
          current.segmentType ?? '',
          next.segmentType ?? '',
        );
        if (gap < threshold) {
          conflicts.push({
            type: 'CONNECTION_TIGHT',
            entityType: 'SEGMENT',
            entityId: next.segmentId,
            summary: `Only ${Math.round(gap)} minutes between arrival and next departure — minimum recommended is ${threshold}.`,
            details: {
              previousSegmentId: current.segmentId,
              nextSegmentId: next.segmentId,
              gapMinutes: Math.round(gap),
              threshold,
              previousArrival: current.arrivalLocation,
              nextDeparture: next.departureLocation,
            },
            suppressionKey: `TIGHT:${current.segmentId}:${next.segmentId}`,
          });
        }
      }
    }
  }

  if (budgets.length && expenses.length) {
    // Only count confirmed expenses against budget. Pending suggestions
    // (EXTRACTED_FARE with userConfirmed=false) should not trigger a
    // budget overspend alert.
    const confirmedExpenses = expenses.filter(
      e =>
        !(
          e.sourceType === 'EXTRACTED_FARE' &&
          e.userConfirmed !== true
        ),
    );

    const budgetTotal = budgets.reduce(
      (sum, b) => sum + Number(b.plannedAmount),
      0,
    );

    const expenseTotal = confirmedExpenses.reduce(
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
    const byBooking = new Map<string, typeof documents>();

    for (const doc of documents) {
      if (!doc.bookingReference || !doc.supplierName) continue;

      const key = `${clean(doc.supplierName)}:${clean(doc.bookingReference)}`;
      const arr = byBooking.get(key) ?? [];
      arr.push(doc);
      byBooking.set(key, arr);
    }

    for (const [key, docs] of byBooking) {
      const hashes = new Set(docs.map(d => d.contentHash));

      if (hashes.size > 1) {
        conflicts.push({
          type: 'DOCUMENT',
          entityType: 'DOCUMENT',
          entityId: docs[0].documentId,
          summary:
            'Multiple source documents share a booking reference but contain different source evidence.',
          details: {
            bookingKey: key,
            documentIds: docs.map(d => d.documentId),
          },
          suppressionKey: `DOCUMENT:${key}:${[...hashes].sort().join(',')}`,
        });
      }
    }
  }

  return db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const activeKeys = new Set(
        conflicts.map(c => c.suppressionKey),
      );

      const existing = await tx.conflict.findMany({
        where: { tenantId, tripId },
      });

      for (const conflict of conflicts) {
        const current = existing.find(
          x => x.suppressionKey === conflict.suppressionKey,
        );

        // If this conflict (same suppression key) is already recorded in
        // any state, do not duplicate it. Users resolve; recompute respects.
        if (current) continue;

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

      // Auto-resolve any DETECTED conflict whose suppression key is no
      // longer active. This handles the "I corrected the data" case:
      // the conflict disappears from the wallet once it stops being true.
      const toAutoResolve = existing.filter(
        c =>
          c.status === 'DETECTED' &&
          c.suppressionKey &&
          !activeKeys.has(c.suppressionKey),
      );

      for (const c of toAutoResolve) {
        await tx.conflict.update({
          where: { conflictId: c.conflictId },
          data: { status: 'RESOLVED', resolvedAt: new Date() },
        });
        await recordEvent(tx, {
          tenantId,
          tripId,
          eventName: 'CONFLICT_AUTO_RESOLVED',
          actorType: 'SYSTEM',
          payload: { conflictId: c.conflictId, conflictType: c.conflictType },
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

        const gap = gapMinutes(from.arrivalUtc, to.departureUtc);

        const existing = await tx.connection.findFirst({
          where: {
            tenantId,
            tripId,
            fromSegmentId: from.segmentId,
            toSegmentId: to.segmentId,
          },
        });

        if (existing) continue;

        if (gap !== null && gap >= 0 && gap <= 24 * 60) {
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

      // Only delete stale INFERRED connections. User-confirmed connections
      // (isInferred === false) are preserved even if the segments they
      // reference change.
      const stale = existing.filter(
        c =>
          c.isInferred &&
          !desired.has(`${c.fromSegmentId}:${c.toSegmentId}`),
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