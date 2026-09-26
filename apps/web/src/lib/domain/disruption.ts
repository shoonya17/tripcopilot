import { db } from '../db';

export type DisruptionSegmentRef = {
  segmentId: string;
  segmentType: string;
  supplierName: string | null;
  departureLocation: string | null;
  arrivalLocation: string | null;
  departureUtc: string | null;
};

export type DisruptionImpact = {
  segmentId: string;
  segmentType: string;
  supplierName: string | null;
  departureLocation: string | null;
  arrivalLocation: string | null;
  departureUtc: string | null;
  gapMinutes: number | null;
  reason: string;
};

export type DisruptionExpense = {
  expenseId: string;
  amount: string;
  currency: string;
  merchantOrDescription: string;
  reason: string;
};

export type DisruptionConflict = {
  conflictId: string;
  conflictType: string;
  summary: string;
};

export type Disruption = {
  segment: DisruptionSegmentRef;
  status: 'CANCELLED' | 'CHANGED';
  affectedSegments: DisruptionImpact[];
  affectedExpenses: DisruptionExpense[];
  affectedConflicts: DisruptionConflict[];
};

export type DisruptionSummary = {
  hasDisruption: boolean;
  disruptions: Disruption[];
};

const DISRUPTED_STATUSES = new Set(['CANCELLED', 'CHANGED']);

function clean(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function gapMinutes(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function shareLocality(a: string, b: string): boolean {
  const STOPWORDS = new Set([
    'airport', 'station', 'terminal', 'junction', 'hotel', 'bus',
    'railway', 'road', 'street', 'avenue', 'stop', 'stand', 'gate',
    'square', 'park', 'city', 'central', 'centraal', 'international',
    'platform', 'depot', 'port', 'harbour', 'harbor',
  ]);
  const wordsA = a.split(/[,\s()\-]+/).filter(w => w.length > 3 && !STOPWORDS.has(w));
  const wordsB = b.split(/[,\s()\-]+/).filter(w => w.length > 3 && !STOPWORDS.has(w));
  if (wordsA.length === 0 || wordsB.length === 0) return a === b;
  return wordsA.some(w => wordsB.includes(w));
}

export async function getDisruptionSummary(
  tripId: string,
  tenantId: string,
): Promise<DisruptionSummary> {
  const [segments, expenses, conflicts] = await Promise.all([
    db.segment.findMany({
      where: { tripId, tenantId },
      orderBy: { departureUtc: 'asc' },
    }),
    db.expense.findMany({
      where: { tripId, tenantId },
    }),
    db.conflict.findMany({
      where: { tripId, tenantId, status: 'DETECTED' },
    }),
  ]);

  const disrupted = segments.filter(s =>
    DISRUPTED_STATUSES.has(String(s.status)),
  );

  if (disrupted.length === 0) {
    return { hasDisruption: false, disruptions: [] };
  }

  const disruptions: Disruption[] = disrupted.map(d => {
    const status = String(d.status) as 'CANCELLED' | 'CHANGED';
    const dIndex = segments.findIndex(s => s.segmentId === d.segmentId);

    const downstream = segments.slice(dIndex + 1);

    const affectedSegments: DisruptionImpact[] = downstream
      .filter(next => {
        // A downstream segment is affected if:
        // - it departs from the same city the disrupted segment would arrive
        // - OR it departs within 24h of the disrupted segment's arrival
        const sameCity =
          d.arrivalLocation &&
          next.departureLocation &&
          shareLocality(
            clean(d.arrivalLocation),
            clean(next.departureLocation),
          );
        const gap = gapMinutes(d.arrivalUtc, next.departureUtc);
        const closeInTime = gap !== null && gap >= 0 && gap <= 24 * 60;
        return Boolean(sameCity || closeInTime);
      })
      .map(next => {
        const gap = gapMinutes(d.arrivalUtc, next.departureUtc);
        let reason: string;
        if (gap === null) {
          reason = 'connection may no longer be valid';
        } else if (gap < 0) {
          reason = 'now departs before the disrupted segment would have arrived';
        } else if (gap < 90) {
          reason = `only ${gap} min after scheduled arrival`;
        } else if (gap < 24 * 60) {
          reason = `departs ${Math.round(gap / 60)}h after scheduled arrival`;
        } else {
          reason = 'downstream on the same route';
        }
        return {
          segmentId: next.segmentId,
          segmentType: next.segmentType,
          supplierName: next.supplierName,
          departureLocation: next.departureLocation,
          arrivalLocation: next.arrivalLocation,
          departureUtc: next.departureUtc?.toISOString() ?? null,
          gapMinutes: gap,
          reason,
        };
      });

    const dSupplier = clean(d.supplierName);
    const dRef = clean(d.bookingReference);
    const affectedExpenses: DisruptionExpense[] = expenses
      .filter(e => {
        if (e.userConfirmed && e.sourceType !== 'EXTRACTED_FARE') {
          // still check user expenses against supplier match
        }
        const eMerchant = clean(e.merchantOrDescription);
        const supplierMatch =
          dSupplier.length > 3 && eMerchant.includes(dSupplier);
        const refMatch =
          dRef.length > 3 && eMerchant.includes(dRef);
        return supplierMatch || refMatch;
      })
      .map(e => ({
        expenseId: e.expenseId,
        amount: String(e.amount),
        currency: e.currency,
        merchantOrDescription: e.merchantOrDescription,
        reason: e.userConfirmed
          ? 'confirmed expense linked to this booking — may be refundable'
          : 'pending expense linked to this booking',
      }));

    const affectedConflicts: DisruptionConflict[] = conflicts
      .filter(c => {
        const details = c.details as any;
        if (!details) return false;
        if (details.previousSegmentId === d.segmentId) return true;
        if (details.nextSegmentId === d.segmentId) return true;
        if (details.matchedEntityId === d.segmentId) return true;
        return false;
      })
      .map(c => ({
        conflictId: c.conflictId,
        conflictType: String(c.conflictType),
        summary: c.summary ?? c.description ?? '',
      }));

    return {
      segment: {
        segmentId: d.segmentId,
        segmentType: d.segmentType,
        supplierName: d.supplierName,
        departureLocation: d.departureLocation,
        arrivalLocation: d.arrivalLocation,
        departureUtc: d.departureUtc?.toISOString() ?? null,
      },
      status,
      affectedSegments,
      affectedExpenses,
      affectedConflicts,
    };
  });

  return { hasDisruption: true, disruptions };
}