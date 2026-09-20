import { db } from '../db';
import { recordEvent } from '../events';
import { recordAudit } from '../audit';

export async function getTripPreferences(tripId: string, tenantId: string) {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  return db.preferenceSet.findMany({ where: { tenantId, tripId, scope: 'TRIP' }, orderBy: { preferenceKey: 'asc' } });
}
export async function getTravelerPreferences(travelerId: string, tenantId: string) {
  const traveler = await db.traveler.findFirst({ where: { travelerId, tenantId } });
  if (!traveler) throw new Error('NOT_FOUND: traveler');
  return db.preferenceSet.findMany({ where: { tenantId, travelerId, scope: 'TRAVELER', tripId: null }, orderBy: { preferenceKey: 'asc' } });
}

export async function upsertPreference(input: { tenantId: string; travelerId: string; tripId?: string; scope: 'TRAVELER'|'TRIP'; key: string; value: unknown; rowVersion?: number; actorId?: string; }) {
  if (input.scope === 'TRIP' && !input.tripId) throw new Error('VALIDATION: trip scope requires tripId');
  if (input.scope === 'TRAVELER' && input.tripId) throw new Error('VALIDATION: traveler scope cannot include tripId');
  const existing = await db.preferenceSet.findFirst({ where: { tenantId: input.tenantId, scope: input.scope, travelerId: input.scope === 'TRAVELER' ? input.travelerId : null, tripId: input.scope === 'TRIP' ? input.tripId : null, preferenceKey: input.key } });
  if (existing) {
    if (input.rowVersion == null) throw new Error('VALIDATION: row_version required for preference update');
    return db.$transaction(async tx => {
      const result = await tx.preferenceSet.updateMany({ where: { preferenceSetId: existing.preferenceSetId, tenantId: input.tenantId, rowVersion: input.rowVersion }, data: { preferenceValue: input.value as any, rowVersion: { increment: 1 } } });
      if (result.count !== 1) throw new Error('STALE_VERSION: preference');
      const updated = await tx.preferenceSet.findUniqueOrThrow({ where: { preferenceSetId: existing.preferenceSetId } });
      await recordAudit(tx, { tenantId: input.tenantId, tripId: input.tripId, actorType: 'USER', actorId: input.actorId, action: 'PREFERENCE_UPDATED', entityType: 'PREFERENCE_SET', entityId: updated.preferenceSetId, metadata: { preferenceKey: input.key, scope: input.scope } });
      return updated;
    });
  }
  const created = await db.preferenceSet.create({ data: { tenantId: input.tenantId, scope: input.scope, travelerId: input.scope === 'TRAVELER' ? input.travelerId : null, tripId: input.scope === 'TRIP' ? input.tripId : null, preferenceKey: input.key, preferenceValue: input.value as any } });
  await recordEvent(db, { tenantId: input.tenantId, tripId: input.tripId, eventName: 'PREFERENCE_UPDATED', actorType: 'USER', actorId: input.actorId, payload: { preferenceSetId: created.preferenceSetId, scope: input.scope, preferenceKey: input.key } });
  return created;
}

export async function getEffectivePreferences(tripId: string, tenantId: string, travelerId: string) {
  const [traveler, trip] = await Promise.all([getTravelerPreferences(travelerId, tenantId), getTripPreferences(tripId, tenantId)]);
  const merged = new Map(traveler.map(p => [p.preferenceKey, p.preferenceValue]));
  for (const p of trip) merged.set(p.preferenceKey, p.preferenceValue);
  return Object.fromEntries(merged.entries());
}
