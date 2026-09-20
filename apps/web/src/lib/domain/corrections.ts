import { db } from '../db';
import { correctionSchema, zonedDateTimeToUtc } from '@tripcopilot/core';
import { writeProvenance } from '../provenance';
import { recordEvent } from '../events';
import { recordAudit } from '../audit';
import { recomputeTripRelations } from './derived';

const SEGMENT_STATUS_TRANSITIONS: Record<string, Set<string>> = {
  UNKNOWN: new Set(['BOOKED','CONFIRMED']),
  BOOKED: new Set(['CONFIRMED']),
  CONFIRMED: new Set(['CHANGED','CANCELLED','COMPLETED']),
  CHANGED: new Set(['CONFIRMED','CANCELLED','COMPLETED']),
  CANCELLED: new Set(),
  COMPLETED: new Set(),
};

const allowed: Record<string, Set<string>> = {
  TRIP: new Set(['title','start_at','end_at','start_timezone','end_timezone','status']),
  SEGMENT: new Set(['segment_type','supplier_name','booking_reference','departure_local','departure_timezone','arrival_local','arrival_timezone','departure_location','arrival_location','status']),
  CONNECTION: new Set(['connection_type']),
  BUDGET: new Set(['planned_amount','currency','category','notes']),
  EXPENSE: new Set(['amount','currency','category','merchant_or_description','incurred_at','location']),
  PREFERENCE_SET: new Set(['preference_value']),
};

const idField: Record<string, string> = {
  SEGMENT: 'segmentId', CONNECTION: 'connectionId', BUDGET: 'budgetId', EXPENSE: 'expenseId', PREFERENCE_SET: 'preferenceSetId',
};
const tripScopedEntity = new Set(['SEGMENT','CONNECTION','BUDGET','EXPENSE']);

function dbField(field: string) {
  return ({
    start_at: 'startAt', end_at: 'endAt', start_timezone: 'startTimezone', end_timezone: 'endTimezone',
    segment_type: 'segmentType', supplier_name: 'supplierName', booking_reference: 'bookingReference',
    departure_local: 'departureLocal', departure_timezone: 'departureTimezone', arrival_local: 'arrivalLocal', arrival_timezone: 'arrivalTimezone',
    departure_location: 'departureLocation', arrival_location: 'arrivalLocation',
    planned_amount: 'plannedAmount', merchant_or_description: 'merchantOrDescription', incurred_at: 'incurredAt',
    preference_value: 'preferenceValue', connection_type: 'connectionType', title: 'title', status: 'status', amount: 'amount', currency: 'currency', category: 'category', notes: 'notes', location: 'location',
  } as Record<string,string>)[field] ?? field;
}

function localWallClockDate(local: string) {
  const parsed = new Date(local.endsWith('Z') ? local : `${local}Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error('VALIDATION: invalid local datetime');
  return parsed;
}

function normalizeValue(field: string, value: unknown, timezone?: string | null) {
  if (['start_at','end_at','departure_local','arrival_local','incurred_at'].includes(field) && typeof value === 'string') {
    if (['departure_local','arrival_local'].includes(field)) {
      return localWallClockDate(value);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error(`VALIDATION: invalid date for ${field}`);
    return parsed;
  }
  if (['departure_timezone','arrival_timezone','start_timezone','end_timezone'].includes(field) && typeof value === 'string') {
    try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); } catch { throw new Error(`VALIDATION: invalid timezone for ${field}`); }
  }
  if (field === 'currency' && (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value))) throw new Error('VALIDATION: invalid currency');
  if (field === 'amount' || field === 'planned_amount') if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`VALIDATION: invalid ${field}`);
  return value;
}

export async function applyCorrection(tripId: string, tenantId: string, actorId: string, raw: unknown) {
  const input = correctionSchema.parse(raw) as typeof correctionSchema._output & { row_version?: number };
  if (!allowed[input.entity_type]?.has(input.field_name)) throw new Error('VALIDATION: field is not correctable');
  const targetTrip = await db.trip.findFirst({ where: { tripId, tenantId } });
  if (!targetTrip) throw new Error('NOT_FOUND: trip');
  if (targetTrip.ownerTravelerId !== actorId) throw new Error('FORBIDDEN: only trip owner may correct trip data');

  const table: any = {
    TRIP: db.trip, SEGMENT: db.segment, CONNECTION: db.connection, BUDGET: db.budget, EXPENSE: db.expense, PREFERENCE_SET: db.preferenceSet,
  }[input.entity_type];
  const primaryWhere = input.entity_type === 'TRIP' ? { tripId: input.entity_id } : { [idField[input.entity_type]]: input.entity_id };
  const record = await table.findUnique({ where: primaryWhere });
  if (!record) throw new Error('NOT_FOUND: correction target');
  if (record.tenantId !== tenantId) throw new Error('FORBIDDEN');
  if (tripScopedEntity.has(input.entity_type) && record.tripId !== tripId) throw new Error('FORBIDDEN: correction target is outside trip');
  if (input.entity_type === 'PREFERENCE_SET' && record.tripId && record.tripId !== tripId) throw new Error('FORBIDDEN: correction target is outside trip');
  if (input.entity_type === 'PREFERENCE_SET' && record.scope === 'TRAVELER' && record.travelerId !== actorId) throw new Error('FORBIDDEN: traveler preference belongs to another traveler');
  if (record.rowVersion == null) throw new Error('VALIDATION: correction target is immutable');
  if (input.row_version == null) throw new Error('VALIDATION: row_version required for correction');
  if (record.rowVersion !== input.row_version) throw new Error('STALE_VERSION: correction target');

  const field = dbField(input.field_name);
  const timezone = input.timezone ?? (input.entity_type === 'SEGMENT' ? (input.field_name === 'departure_local' || input.field_name === 'departure_timezone' ? record.departureTimezone : input.field_name === 'arrival_local' || input.field_name === 'arrival_timezone' ? record.arrivalTimezone : undefined) : undefined);
  const value = normalizeValue(input.field_name, input.new_value, timezone);
  const updateData: Record<string, unknown> = { [field]: value, rowVersion: { increment: 1 } };
  if (input.entity_type === 'SEGMENT' && input.field_name === 'departure_local' && typeof input.new_value === 'string') { updateData.departureUtc = zonedDateTimeToUtc(input.new_value, timezone) ?? null; }
  if (input.entity_type === 'SEGMENT' && input.field_name === 'arrival_local' && typeof input.new_value === 'string') { updateData.arrivalUtc = zonedDateTimeToUtc(input.new_value, timezone) ?? null; }
  if (input.entity_type === 'SEGMENT' && input.field_name === 'departure_timezone' && record.departureLocal) { updateData.departureUtc = zonedDateTimeToUtc(record.departureLocal.toISOString().replace('Z',''), String(value)) ?? record.departureUtc; }
  if (input.entity_type === 'SEGMENT' && input.field_name === 'arrival_timezone' && record.arrivalLocal) { updateData.arrivalUtc = zonedDateTimeToUtc(record.arrivalLocal.toISOString().replace('Z',''), String(value)) ?? record.arrivalUtc; }

  return db.$transaction(async tx => {
    const scopedWhere = input.entity_type === 'TRIP'
      ? { tripId: input.entity_id, tenantId, rowVersion: input.row_version }
      : { [idField[input.entity_type]]: input.entity_id, tenantId, rowVersion: input.row_version };
    const result = await tableFor(tx, input.entity_type).updateMany({ where: scopedWhere, data: updateData });
    if (result.count !== 1) throw new Error('STALE_VERSION: correction target');
    const updated = await tableFor(tx, input.entity_type).findUnique({ where: primaryWhere });
    await writeProvenance(tx, {
      tenantId,
      entityType: input.entity_type,
      entityId: input.entity_id,
      fieldName: input.field_name,
      sourceKind: 'USER',
      sourceId: actorId,
      isUserOriginated: true,
      userActorId: actorId,
      sourceExcerpt: JSON.stringify(input.new_value),
    });
    await recordAudit(tx, { tenantId, tripId, actorType: 'USER', actorId, action: 'FIELD_CORRECTED', entityType: input.entity_type, entityId: input.entity_id, metadata: { fieldName: input.field_name, beforeRowVersion: input.row_version, reason: input.reason ?? null } });
    await recordEvent(tx, { tenantId, tripId, eventName: input.entity_type === 'EXPENSE' ? 'EXPENSE_CORRECTED' : 'FIELD_CORRECTED', actorType: 'USER', actorId, behavioralClass: 'CORRECTION', payload: { entityType: input.entity_type, entityId: input.entity_id, fieldName: input.field_name, reason: input.reason } });
    return updated;
  }).then(async result => { await recomputeTripRelations(tripId, tenantId); return result; });
}

function tableFor(tx: any, entityType: string) {
  return { TRIP: tx.trip, SEGMENT: tx.segment, CONNECTION: tx.connection, BUDGET: tx.budget, EXPENSE: tx.expense, PREFERENCE_SET: tx.preferenceSet }[entityType];
}
