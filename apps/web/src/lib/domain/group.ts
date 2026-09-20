import { db } from '../db';
import { recordEvent } from '../events';

async function getOwnedTrip(tripId: string, tenantId: string, ownerTravelerId: string) {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  if (trip.ownerTravelerId !== ownerTravelerId) throw new Error('FORBIDDEN: only trip owner may manage group');
  return trip;
}

export async function getGroup(tripId: string, tenantId: string) {
  const group = await db.groupTrip.findFirst({ where: { tripId, tenantId }, include: { participants: true } });
  return group;
}

export async function getOrCreateGroup(tripId: string, tenantId: string, ownerTravelerId: string) {
  await getOwnedTrip(tripId, tenantId, ownerTravelerId);
  const existing = await db.groupTrip.findFirst({ where: { tripId, tenantId }, include: { participants: true } });
  if (existing) return existing;
  return db.$transaction(async tx => {
    const group = await tx.groupTrip.create({ data: { tenantId, tripId, ownerTravelerId, name: 'Travel Group', status: 'ACTIVE' } });
    await tx.groupParticipant.create({ data: { groupTripId: group.groupTripId, travelerId: ownerTravelerId, role: 'OWNER', status: 'ACTIVE' } });
    await recordEvent(tx, { tenantId, tripId, eventName: 'GROUP_COORDINATED', actorType: 'USER', actorId: ownerTravelerId, payload: { groupTripId: group.groupTripId, action: 'created' } });
    return tx.groupTrip.findUniqueOrThrow({ where: { groupTripId: group.groupTripId }, include: { participants: true } });
  });
}

export async function addParticipant(tripId: string, tenantId: string, actorId: string, travelerId: string) {
  await getOwnedTrip(tripId, tenantId, actorId);
  const group = await getOrCreateGroup(tripId, tenantId, actorId);
  const traveler = await db.traveler.findFirst({ where: { travelerId, tenantId } });
  if (!traveler) throw new Error('NOT_FOUND: traveler');
  if (travelerId === actorId) return db.groupParticipant.findUniqueOrThrow({ where: { groupTripId_travelerId: { groupTripId: group.groupTripId, travelerId } } });
  const participant = await db.groupParticipant.upsert({
    where: { groupTripId_travelerId: { groupTripId: group.groupTripId, travelerId } },
    update: { status: 'ACTIVE', leftAt: null },
    create: { groupTripId: group.groupTripId, travelerId, role: 'PARTICIPANT', status: 'ACTIVE' },
  });
  await recordEvent(db, { tenantId, tripId, eventName: 'GROUP_COORDINATED', actorType: 'USER', actorId, payload: { groupTripId: group.groupTripId, action: 'participant_added', travelerId } });
  return participant;
}

export async function removeParticipant(tripId: string, tenantId: string, actorId: string, travelerId: string) {
  await getOwnedTrip(tripId, tenantId, actorId);
  const group = await getGroup(tripId, tenantId);
  if (!group) throw new Error('NOT_FOUND: group');
  if (travelerId === actorId) throw new Error('VALIDATION: owner cannot be removed');
  const participant = await db.groupParticipant.update({ where: { groupTripId_travelerId: { groupTripId: group.groupTripId, travelerId } }, data: { status: 'LEFT', leftAt: new Date() } });
  await recordEvent(db, { tenantId, tripId, eventName: 'GROUP_COORDINATED', actorType: 'USER', actorId, payload: { groupTripId: group.groupTripId, action: 'participant_removed', travelerId } });
  return participant;
}
