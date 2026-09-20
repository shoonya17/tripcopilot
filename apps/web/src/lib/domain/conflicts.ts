import { db } from '../db';
import { recordEvent } from '../events';

export async function listConflicts(tripId: string, tenantId: string) {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  const [conflicts, dismissals] = await Promise.all([
    db.conflict.findMany({ where: { tripId, tenantId }, orderBy: { createdAt: 'desc' } }),
    db.eventLog.findMany({ where: { tripId, tenantId, eventName: 'CONFLICT_DISMISSED' }, orderBy: { occurredAt: 'desc' }, take: 500, select: { occurredAt: true, payload: true } }),
  ]);
  const dismissedAfterCreation = new Map<string, number>();
  for (const event of dismissals) {
    const conflictId = typeof event.payload === 'object' && event.payload && 'conflictId' in event.payload ? String((event.payload as any).conflictId) : null;
    if (!conflictId || dismissedAfterCreation.has(conflictId)) continue;
    dismissedAfterCreation.set(conflictId, event.occurredAt.getTime());
  }
  return conflicts.filter(conflict => {
    const dismissedAt = dismissedAfterCreation.get(conflict.conflictId);
    return !dismissedAt || dismissedAt < conflict.createdAt.getTime();
  });
}

export async function updateConflictStatus(tripId: string, conflictId: string, tenantId: string, status: 'REVIEWED'|'RESOLVED', actorId: string) {
  const conflict = await db.conflict.findFirst({ where: { conflictId, tripId, tenantId } });
  if (!conflict) throw new Error('NOT_FOUND: conflict');
  if (status === 'REVIEWED' && conflict.status !== 'DETECTED') throw new Error('CONFLICT: conflict must be DETECTED before review');
  if (status === 'RESOLVED' && conflict.status !== 'REVIEWED') throw new Error('CONFLICT: conflict must be REVIEWED before resolution');
  return db.$transaction(async tx => {
    const update = await tx.conflict.updateMany({ where: { conflictId, tenantId, rowVersion: conflict.rowVersion }, data: {
      status,
      reviewedAt: status === 'REVIEWED' ? new Date() : conflict.reviewedAt,
      resolvedAt: status === 'RESOLVED' ? new Date() : null,
      rowVersion: { increment: 1 },
    } });
    if (update.count !== 1) throw new Error('STALE_VERSION: conflict');
    const updated = await tx.conflict.findUniqueOrThrow({ where: { conflictId } });
    await recordEvent(tx, { tenantId, tripId, eventName: status === 'REVIEWED' ? 'CONFLICT_REVIEWED' : 'CONFLICT_RESOLVED', actorType: 'USER', actorId, payload: { conflictId } });
    return updated;
  });
}

export async function dismissConflict(tripId: string, conflictId: string, tenantId: string, actorId: string, reason?: string) {
  const conflict = await db.conflict.findFirst({ where: { conflictId, tripId, tenantId } });
  if (!conflict) throw new Error('NOT_FOUND: conflict');
  await recordEvent(db, { tenantId, tripId, eventName: 'CONFLICT_DISMISSED', actorType: 'USER', actorId, behavioralClass: null, payload: { conflictId, reason, dismissedAt: new Date().toISOString() } });
  return { status: conflict.status, dismissed: true };
}

export async function reopenConflict(tripId: string, conflictId: string, tenantId: string, actorId: string) {
  const conflict = await db.conflict.findFirst({ where: { conflictId, tripId, tenantId } });
  if (!conflict) throw new Error('NOT_FOUND: conflict');
  if (conflict.status !== 'RESOLVED') throw new Error('CONFLICT: only resolved conflicts may be reopened');
  return db.$transaction(async tx => {
    const update = await tx.conflict.updateMany({ where: { conflictId, tenantId, rowVersion: conflict.rowVersion }, data: { status: 'DETECTED', resolvedAt: null, rowVersion: { increment: 1 } } });
    if (update.count !== 1) throw new Error('STALE_VERSION: conflict');
    const updated = await tx.conflict.findUniqueOrThrow({ where: { conflictId } });
    await recordEvent(tx, { tenantId, tripId, eventName: 'CONFLICT_REOPENED', actorType: 'USER', actorId, payload: { conflictId } });
    return updated;
  });
}
