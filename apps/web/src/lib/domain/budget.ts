import { db } from '../db';
import { recordEvent } from '../events';

export async function getBudget(tripId: string, tenantId: string) {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  return db.budget.findMany({ where: { tripId, tenantId }, orderBy: { category: 'asc' } });
}

export async function putBudget(
  tripId: string,
  tenantId: string,
  actorId: string,
  rows: Array<{ budgetId?: string; currency: string; planned_amount: number; category?: string; notes?: string; row_version?: number }>
) {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId, ownerTravelerId: actorId } });
  if (!trip) throw new Error('FORBIDDEN: only trip owner may change budget');
  if (!Array.isArray(rows)) throw new Error('VALIDATION: budget must be an array');
  if (rows.some(r => !/^[A-Z]{3}$/.test(r.currency) || !Number.isFinite(r.planned_amount) || r.planned_amount < 0)) {
    throw new Error('VALIDATION: invalid budget row');
  }

  return db.$transaction(async tx => {
    const results = [];
    for (const r of rows) {
      if (r.budgetId) {
        if (r.row_version == null) throw new Error('VALIDATION: row_version required for budget update');
        const current = await tx.budget.findFirst({ where: { budgetId: r.budgetId, tripId, tenantId } });
        if (!current) throw new Error('NOT_FOUND: budget');
        const update = await tx.budget.updateMany({
          where: { budgetId: r.budgetId, tenantId, rowVersion: r.row_version },
          data: { currency: r.currency, plannedAmount: r.planned_amount, category: r.category, notes: r.notes, rowVersion: { increment: 1 } },
        });
        if (update.count !== 1) throw new Error('STALE_VERSION: budget');
        results.push(await tx.budget.findUniqueOrThrow({ where: { budgetId: r.budgetId } }));
      } else {
        const created = await tx.budget.create({ data: { tenantId, tripId, currency: r.currency, plannedAmount: r.planned_amount, category: r.category, notes: r.notes } });
        results.push(created);
      }
    }
    await recordEvent(tx, { tenantId, tripId, eventName: 'BUDGET_UPDATED', actorType: 'USER', actorId, payload: { count: rows.length } });
    return results;
  });
}
