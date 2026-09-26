import { db } from '../db';
import { deriveRightNow, sortSegments } from '@tripcopilot/core';
import { recordEvent } from '../events';
import { recordAudit } from '../audit';
import { recomputeTripRelations } from './derived';

const TRIP_TRANSITIONS: Record<string, Set<string>> = {
  PLANNED: new Set(['ACTIVE','CANCELLED']),
  ACTIVE: new Set(['COMPLETED','CANCELLED']),
  COMPLETED: new Set(['ARCHIVED']),
  CANCELLED: new Set(['ARCHIVED']),
  ARCHIVED: new Set(),
};

function validateTripStatusTransition(current: string, next: string) {
  if (current === next) return;
  if (!TRIP_TRANSITIONS[current]?.has(next)) throw new Error(`CONFLICT: invalid trip status transition ${current} -> ${next}`);
}

export async function advanceTripLifecycle(now = new Date()) {
  const trips = await db.trip.findMany({ where: { status: { in: ['PLANNED','ACTIVE'] } }, include: { segments: { orderBy: { arrivalUtc: 'asc' } } } });
  let activated = 0, completed = 0;
  for (const trip of trips) {
    if (trip.status === 'PLANNED' && trip.startAt && trip.startAt <= now && (!trip.endAt || trip.endAt > now)) {
      await db.$transaction(async tx => {
        const result = await tx.trip.updateMany({ where: { tripId: trip.tripId, tenantId: trip.tenantId, rowVersion: trip.rowVersion, status: 'PLANNED' }, data: { status: 'ACTIVE', rowVersion: { increment: 1 } } });
        if (result.count) await recordEvent(tx, { tenantId: trip.tenantId, tripId: trip.tripId, eventName: 'TRIP_ACTIVATED', actorType: 'SYSTEM', payload: { reason: 'scheduled_lifecycle' } });
      });
      activated++;
    }
    if (trip.status === 'ACTIVE' && trip.segments.length && trip.segments.every(s => s.arrivalUtc && s.arrivalUtc <= now)) {
      await db.$transaction(async tx => {
        const result = await tx.trip.updateMany({ where: { tripId: trip.tripId, tenantId: trip.tenantId, rowVersion: trip.rowVersion, status: 'ACTIVE' }, data: { status: 'COMPLETED', rowVersion: { increment: 1 } } });
        if (result.count) await recordEvent(tx, { tenantId: trip.tenantId, tripId: trip.tripId, eventName: 'TRIP_COMPLETED', actorType: 'SYSTEM', payload: { reason: 'final_segment_ended' } });
      });
      completed++;
    }
  }
  return { activated, completed };
}


export async function listTrips(tenantId: string, travelerId: string) {
  return db.trip.findMany({ where: { tenantId, ownerTravelerId: travelerId, status: { not: 'ARCHIVED' } }, include: { segments: { orderBy: { departureUtc: 'asc' } }, expenses: { orderBy: { incurredAt: 'desc' }, take: 10 }, conflicts: { where: { status: { not: 'RESOLVED' } } } }, orderBy: { startAt: 'desc' } });
}

export async function getTrip(tripId: string, tenantId: string) {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId }, include: { owner: true, segments: { orderBy: { departureUtc: 'asc' } }, documents: { orderBy: { receivedAt: 'desc' } }, budgets: true, expenses: { orderBy: { incurredAt: 'desc' } }, preferences: true, conflicts: { orderBy: { createdAt: 'desc' } }, group: { include: { participants: true } }, consents: true } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  return trip;
}

/**
 * Like getTrip, but authorization is "owner OR active participant."
 * Returns the trip plus a `viewer` object indicating what the caller can do.
 * Only the owner can edit; participants see read-only.
 */
export async function getTripForViewer(
  tripId: string,
  tenantId: string,
  travelerId: string,
) {
  const trip = await db.trip.findFirst({
    where: { tripId, tenantId },
    include: {
      owner: true,
      segments: { orderBy: { departureUtc: 'asc' } },
      documents: { orderBy: { receivedAt: 'desc' } },
      budgets: true,
      expenses: { orderBy: { incurredAt: 'desc' } },
      preferences: true,
      conflicts: { orderBy: { createdAt: 'desc' } },
      group: { include: { participants: true } },
      consents: true,
    },
  });
  if (!trip) throw new Error('NOT_FOUND: trip');

  const isOwner = trip.ownerTravelerId === travelerId;

  let isParticipant = false;
  if (!isOwner && trip.group) {
    isParticipant = trip.group.participants.some(
      p => p.travelerId === travelerId && p.status === 'ACTIVE',
    );
  }

  if (!isOwner && !isParticipant) throw new Error('FORBIDDEN');

  return {
    trip,
    viewer: {
      isOwner,
      isParticipant,
      canEdit: isOwner,
    },
  };
}

export async function updateTrip(tripId: string, tenantId: string, actorId: string, rowVersion: number, patch: Record<string, unknown>) {
  if (!Number.isInteger(rowVersion) || rowVersion < 1) throw new Error('VALIDATION: row_version required');
  const trip = await db.trip.findFirst({ where: { tripId, tenantId } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  if (trip.ownerTravelerId !== actorId) throw new Error('FORBIDDEN');
  const allowed = new Set(['title','startAt','endAt','startTimezone','endTimezone','status']);
  const data: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) {
    if (!allowed.has(key)) continue;
    if (key === 'status') {
      if (typeof patch[key] !== 'string') throw new Error('VALIDATION: invalid trip status');
      validateTripStatusTransition(String(trip.status), patch[key] as string);
      data[key] = patch[key];
    } else if (key.endsWith('At') && typeof patch[key] === 'string') data[key] = new Date(patch[key] as string);
    else data[key] = patch[key];
  }
  if (!Object.keys(data).length) throw new Error('VALIDATION: no mutable trip fields');
  return db.$transaction(async tx => {
    const updated = await tx.trip.updateMany({ where: { tripId, tenantId, ownerTravelerId: actorId, rowVersion }, data: { ...data, rowVersion: { increment: 1 } } });
    if (updated.count !== 1) throw new Error('STALE_VERSION: trip');
    const row = await tx.trip.findUniqueOrThrow({ where: { tripId } });
    await recordAudit(tx, { tenantId, tripId, actorType: 'USER', actorId, action: 'TRIP_UPDATED', entityType: 'TRIP', entityId: tripId, metadata: { fields: Object.keys(data), beforeRowVersion: rowVersion } });
    await recordEvent(tx, { tenantId, tripId, eventName: 'TRIP_UPDATED', actorType: 'USER', actorId, payload: { fields: Object.keys(data) } });
    return row;
  }).then(async row => { await recomputeTripRelations(tripId, tenantId); return row; });
}

export async function getTimeline(tripId: string, tenantId: string, actorId?: string) {
  const trip = await getTrip(tripId, tenantId);
  const segments = sortSegments(trip.segments);
  await recordEvent(db, { tenantId, tripId, eventName: 'TIMELINE_REVIEWED', actorType: actorId ? 'USER' : 'SYSTEM', actorId, behavioralClass: actorId ? 'REVIEW' : null, payload: { segmentCount: segments.length } });
  return { tripId, segments, connections: await db.connection.findMany({ where: { tenantId, tripId }, orderBy: { createdAt: 'asc' } }) };
}

export async function getRightNow(tripId: string, tenantId: string, actorId?: string) {
  await getTrip(tripId, tenantId);
  const segments = await db.segment.findMany({ where: { tripId, tenantId }, orderBy: { departureUtc: 'asc' } });
  const view = deriveRightNow(segments.map(s => ({ segmentId: s.segmentId, supplierName: s.supplierName, bookingReference: s.bookingReference, departureUtc: s.departureUtc, departureLocation: s.departureLocation, arrivalLocation: s.arrivalLocation, departureTimezone: s.departureTimezone, status: s.status })));
  await recordEvent(db, { tenantId, tripId, eventName: 'RIGHT_NOW_VIEWED', actorType: 'USER', actorId, payload: { hasUpcoming: view.hasUpcoming } });
  return view;
}

export async function archiveTrip(
  tripId: string,
  tenantId: string,
  actorId: string,
  rowVersion: number,
) {
  if (!Number.isInteger(rowVersion) || rowVersion < 1) {
    throw new Error('VALIDATION: row_version required');
  }

  const trip = await db.trip.findFirst({ where: { tripId, tenantId } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  if (trip.ownerTravelerId !== actorId) throw new Error('FORBIDDEN');

  const updated = await db.trip.updateMany({
    where: { tripId, tenantId, ownerTravelerId: actorId, rowVersion },
    data: { status: 'ARCHIVED', rowVersion: { increment: 1 } },
  });

  if (updated.count !== 1) throw new Error('STALE_VERSION: trip');

  const row = await db.trip.findUniqueOrThrow({ where: { tripId } });

  await db.$transaction(async (tx) => {
    await recordAudit(tx, {
      tenantId,
      tripId,
      actorType: 'USER',
      actorId,
      action: 'TRIP_ARCHIVED',
      entityType: 'TRIP',
      entityId: tripId,
      metadata: { beforeRowVersion: rowVersion },
    });
    await recordEvent(tx, {
      tenantId,
      tripId,
      eventName: 'TRIP_ARCHIVED',
      actorType: 'USER',
      actorId,
      payload: {},
    });
  });

  return row;
}

export async function restoreTrip(
  tripId: string,
  tenantId: string,
  actorId: string,
) {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  if (trip.ownerTravelerId !== actorId) throw new Error('FORBIDDEN');
  if (trip.status !== 'ARCHIVED') {
    throw new Error('CONFLICT: trip is not archived');
  }

  const updated = await db.trip.update({
    where: { tripId },
    data: { status: 'PLANNED', rowVersion: { increment: 1 } },
  });

  await db.$transaction(async (tx) => {
    await recordAudit(tx, {
      tenantId,
      tripId,
      actorType: 'USER',
      actorId,
      action: 'TRIP_RESTORED',
      entityType: 'TRIP',
      entityId: tripId,
      metadata: {},
    });
    await recordEvent(tx, {
      tenantId,
      tripId,
      eventName: 'TRIP_RESTORED',
      actorType: 'USER',
      actorId,
      payload: {},
    });
  });

  return updated;
}

export async function deleteTripPermanently(
  tripId: string,
  tenantId: string,
  actorId: string,
) {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  if (trip.ownerTravelerId !== actorId) throw new Error('FORBIDDEN');
  if (trip.status !== 'ARCHIVED') {
    throw new Error(
      'CONFLICT: only archived trips can be permanently deleted',
    );
  }

  // All Trip relations have onDelete: Cascade in the schema.
  // A single delete call removes segments, expenses, documents,
  // conflicts, connections, provenance, audit and event rows.
  await db.trip.delete({ where: { tripId } });

  return { tripId, deleted: true };
}

export async function listArchivedTrips(
  tenantId: string,
  travelerId: string,
) {
  return db.trip.findMany({
    where: {
      tenantId,
      ownerTravelerId: travelerId,
      status: 'ARCHIVED',
    },
    include: {
      segments: { orderBy: { departureUtc: 'asc' } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}