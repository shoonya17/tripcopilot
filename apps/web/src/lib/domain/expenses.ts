import { db } from '../db';
import { expenseCreateSchema, expenseFingerprint } from '@tripcopilot/core';
import { recordEvent } from '../events';
import { recordAudit } from '../audit';
import { writeProvenance } from '../provenance';

export async function listExpenses(tripId: string, tenantId: string, params: { travelerId?: string; category?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const where = { tripId, tenantId, travelerId: params.travelerId, category: params.category, incurredAt: { gte: params.from ? new Date(params.from) : undefined, lte: params.to ? new Date(params.to) : undefined } };
  const [items, total] = await Promise.all([
    db.expense.findMany({ where, orderBy: { incurredAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    db.expense.count({ where }),
  ]);
  return { items, page, page_size: pageSize, total, has_more: page * pageSize < total };
}

export async function createExpense(tripId: string, tenantId: string, actorId: string, raw: unknown) {
  const input = expenseCreateSchema.parse(raw);
  const trip = await db.trip.findFirst({ where: { tripId, tenantId } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  if (input.traveler_id) {
    const traveler = await db.traveler.findFirst({ where: { travelerId: input.traveler_id, tenantId } });
    if (!traveler) throw new Error('FORBIDDEN: traveler');
  }
  const fingerprint = expenseFingerprint({ tripId, travelerId: input.traveler_id, merchant: input.merchant_or_description, amount: input.amount.toFixed(4), currency: input.currency, incurredAt: input.incurred_at });
  const duplicate = await db.expense.findFirst({ where: { tripId, tenantId, merchantOrDescription: input.merchant_or_description, amount: input.amount, currency: input.currency, incurredAt: new Date(input.incurred_at), travelerId: input.traveler_id } });
  if (duplicate) return { expense: duplicate, duplicate: true, fingerprint };

  return db.$transaction(async tx => {
    const expense = await tx.expense.create({ data: {
      tenantId, tripId, travelerId: input.traveler_id, amount: input.amount, currency: input.currency,
      category: input.category, merchantOrDescription: input.merchant_or_description,
      incurredAt: new Date(input.incurred_at), location: input.location,
      source: 'USER', sourceType: 'MANUAL', userConfirmed: true, confirmedAt: new Date(),
    } });
    for (const [field, value] of [['amount',input.amount],['currency',input.currency],['category',input.category],['merchant_or_description',input.merchant_or_description],['incurred_at',input.incurred_at],['location',input.location]] as const) {
      if (value == null) continue;
      await writeProvenance(tx, { tenantId, entityType: 'EXPENSE', entityId: expense.expenseId, fieldName: field, sourceKind: 'USER', sourceId: actorId, isUserOriginated: true, userActorId: actorId, sourceExcerpt: String(value) });
    }
    await recordAudit(tx, { tenantId, tripId, actorType: 'USER', actorId, action: 'EXPENSE_CREATED', entityType: 'EXPENSE', entityId: expense.expenseId, metadata: { source: 'MANUAL' } });
    await recordEvent(tx, { tenantId, tripId, eventName: 'EXPENSE_CREATED', actorType: 'USER', actorId, behavioralClass: 'OTHER', payload: { expenseId: expense.expenseId } });
    return { expense, duplicate: false, fingerprint };
  });
}

export async function patchExpense(tripId: string, expenseId: string, tenantId: string, actorId: string, rowVersion: number, patch: Record<string, unknown>) {
  if (!Number.isInteger(rowVersion) || rowVersion < 1) throw new Error('VALIDATION: row_version required');
  const existing = await db.expense.findFirst({ where: { expenseId, tripId, tenantId } });
  if (!existing) throw new Error('NOT_FOUND: expense');
  const data: Record<string, unknown> = {};
  if (typeof patch.amount === 'number' && patch.amount > 0) data.amount = patch.amount;
  if (typeof patch.currency === 'string' && /^[A-Z]{3}$/.test(patch.currency)) data.currency = patch.currency;
  if (typeof patch.category === 'string' || patch.category === null) data.category = patch.category;
  if (typeof patch.merchant_or_description === 'string' && patch.merchant_or_description.trim()) data.merchantOrDescription = patch.merchant_or_description.trim();
  if (typeof patch.incurred_at === 'string' && !Number.isNaN(new Date(patch.incurred_at).getTime())) data.incurredAt = new Date(patch.incurred_at);
  if (typeof patch.location === 'string' || patch.location === null) data.location = patch.location;
  if (!Object.keys(data).length) throw new Error('VALIDATION: no mutable fields');

  return db.$transaction(async tx => {
    const updateResult = await tx.expense.updateMany({ where: { expenseId, tenantId, rowVersion }, data: { ...data, userConfirmed: true, confirmedAt: new Date(), rowVersion: { increment: 1 } } });
    if (updateResult.count !== 1) throw new Error('STALE_VERSION: expense');
    const updated = await tx.expense.findUniqueOrThrow({ where: { expenseId } });
    for (const [field, value] of Object.entries(data)) await writeProvenance(tx, { tenantId, entityType: 'EXPENSE', entityId: expenseId, fieldName: field, sourceKind: 'USER', sourceId: actorId, isUserOriginated: true, userActorId: actorId, sourceExcerpt: String(value) });
    await recordAudit(tx, { tenantId, tripId, actorType: 'USER', actorId, action: 'EXPENSE_CORRECTED', entityType: 'EXPENSE', entityId: expenseId, metadata: { changedFields: Object.keys(data), beforeRowVersion: rowVersion } });
    await recordEvent(tx, { tenantId, tripId, eventName: 'EXPENSE_CORRECTED', actorType: 'USER', actorId, behavioralClass: 'CORRECTION', payload: { expenseId, changedFields: Object.keys(data) } });
    return updated;
  });
}


export async function confirmExpense(
  tripId: string,
  expenseId: string,
  tenantId: string,
  actorId: string,
  rowVersion: number,
) {
  if (!Number.isInteger(rowVersion) || rowVersion < 1) {
    throw new Error('VALIDATION: row_version required');
  }
  const existing = await db.expense.findFirst({
    where: { expenseId, tripId, tenantId },
  });
  if (!existing) throw new Error('NOT_FOUND: expense');

  return db.$transaction(async (tx) => {
    const result = await tx.expense.updateMany({
      where: { expenseId, tenantId, rowVersion },
      data: {
        userConfirmed: true,
        confirmedAt: new Date(),
        rowVersion: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new Error('STALE_VERSION: expense');
    const updated = await tx.expense.findUniqueOrThrow({ where: { expenseId } });

    await recordAudit(tx, {
      tenantId,
      tripId,
      actorType: 'USER',
      actorId,
      action: 'EXPENSE_CONFIRMED',
      entityType: 'EXPENSE',
      entityId: expenseId,
      metadata: { beforeRowVersion: rowVersion },
    });
    await recordEvent(tx, {
      tenantId,
      tripId,
      eventName: 'EXPENSE_CONFIRMED',
      actorType: 'USER',
      actorId,
      behavioralClass: 'REVIEW',
      payload: { expenseId },
    });
    return updated;
  });
}

export async function deleteExpense(
  tripId: string,
  expenseId: string,
  tenantId: string,
  actorId: string,
  rowVersion: number,
) {
  if (!Number.isInteger(rowVersion) || rowVersion < 1) {
    throw new Error('VALIDATION: row_version required');
  }
  const existing = await db.expense.findFirst({
    where: { expenseId, tripId, tenantId },
  });
  if (!existing) throw new Error('NOT_FOUND: expense');
  if (existing.userConfirmed && existing.sourceType !== 'EXTRACTED_FARE') {
    throw new Error('CONFLICT: confirmed user expenses cannot be deleted this way');
  }

  await db.$transaction(async (tx) => {
    await tx.expense.deleteMany({
      where: { expenseId, tenantId, rowVersion },
    });
    await recordAudit(tx, {
      tenantId,
      tripId,
      actorType: 'USER',
      actorId,
      action: 'EXPENSE_DISMISSED',
      entityType: 'EXPENSE',
      entityId: expenseId,
      metadata: { sourceType: existing.sourceType },
    });
    await recordEvent(tx, {
      tenantId,
      tripId,
      eventName: 'EXPENSE_DISMISSED',
      actorType: 'USER',
      actorId,
      behavioralClass: 'REVIEW',
      payload: { expenseId },
    });
  });

  return { expenseId, deleted: true };
}