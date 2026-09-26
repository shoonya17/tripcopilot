import { db } from '../db';
import { recordEvent } from '../events';

async function getOwnedTrip(tripId: string, tenantId: string, ownerTravelerId: string) {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  if (trip.ownerTravelerId !== ownerTravelerId) throw new Error('FORBIDDEN: only trip owner may manage group');
  return trip;
}

export async function getGroup(tripId: string, tenantId: string) {
  const group = await db.groupTrip.findFirst({
    where: { tripId, tenantId },
    include: { participants: true },
  });
  if (!group) return null;

  const travelerIds = group.participants.map(p => p.travelerId);
  const travelers = await db.traveler.findMany({
    where: { travelerId: { in: travelerIds }, tenantId },
  });
  const nameMap = new Map(
    travelers.map(t => [
      t.travelerId,
      { displayName: t.displayName, email: t.email },
    ]),
  );

  const participantsWithNames = group.participants.map(p => ({
    ...p,
    traveler: nameMap.get(p.travelerId) ?? { displayName: null, email: null },
  }));

  return { ...group, participants: participantsWithNames };
}

export async function getOrCreateGroup(
  tripId: string,
  tenantId: string,
  ownerTravelerId: string,
) {
  await getOwnedTrip(tripId, tenantId, ownerTravelerId);

  const existing = await db.groupTrip.findFirst({
    where: { tripId, tenantId },
    include: { participants: true },
  });
  if (existing) return getGroup(tripId, tenantId);

  try {
    await db.$transaction(async tx => {
      const group = await tx.groupTrip.create({
        data: {
          tenantId,
          tripId,
          ownerTravelerId,
          name: 'Travel Group',
          status: 'ACTIVE',
        },
      });
      await tx.groupParticipant.create({
        data: {
          groupTripId: group.groupTripId,
          travelerId: ownerTravelerId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });
      await recordEvent(tx, {
        tenantId,
        tripId,
        eventName: 'GROUP_COORDINATED',
        actorType: 'USER',
        actorId: ownerTravelerId,
        payload: { groupTripId: group.groupTripId, action: 'created' },
      });
    });
  } catch (e) {
    // Unique constraint race: another request created the group first.
    // Fall through and return the existing one.
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('Unique constraint')) throw e;
  }

  return getGroup(tripId, tenantId);
}

export async function isActiveParticipant(
  tripId: string,
  tenantId: string,
  travelerId: string,
): Promise<boolean> {
  const group = await db.groupTrip.findFirst({
    where: { tripId, tenantId },
    select: { groupTripId: true },
  });
  if (!group) return false;

  const participant = await db.groupParticipant.findFirst({
    where: {
      groupTripId: group.groupTripId,
      travelerId,
      status: 'ACTIVE',
    },
    select: { groupParticipantId: true },
  });
  return Boolean(participant);
}

export async function addParticipant(
  tripId: string,
  tenantId: string,
  actorId: string,
  travelerId: string,
) {
  await getOwnedTrip(tripId, tenantId, actorId);
  const group = await getOrCreateGroup(tripId, tenantId, actorId);
  if (!group) throw new Error('NOT_FOUND: group');

  const traveler = await db.traveler.findFirst({
    where: { travelerId, tenantId },
  });
  if (!traveler) throw new Error('NOT_FOUND: traveler');

  if (travelerId === actorId) {
    return db.groupParticipant.findUniqueOrThrow({
      where: {
        groupTripId_travelerId: {
          groupTripId: group.groupTripId,
          travelerId,
        },
      },
    });
  }

  const participant = await db.groupParticipant.upsert({
    where: {
      groupTripId_travelerId: {
        groupTripId: group.groupTripId,
        travelerId,
      },
    },
    update: { status: 'ACTIVE', leftAt: null },
    create: {
      groupTripId: group.groupTripId,
      travelerId,
      role: 'PARTICIPANT',
      status: 'ACTIVE',
    },
  });

  await recordEvent(db, {
    tenantId,
    tripId,
    eventName: 'GROUP_COORDINATED',
    actorType: 'USER',
    actorId,
    payload: {
      groupTripId: group.groupTripId,
      action: 'participant_added',
      travelerId,
    },
  });

  return participant;
}

export async function removeParticipant(
  tripId: string,
  tenantId: string,
  actorId: string,
  travelerId: string,
) {
  await getOwnedTrip(tripId, tenantId, actorId);
  const group = await db.groupTrip.findFirst({
    where: { tripId, tenantId },
  });
  if (!group) throw new Error('NOT_FOUND: group');
  if (travelerId === actorId) {
    throw new Error('VALIDATION: owner cannot be removed');
  }
  const participant = await db.groupParticipant.update({
    where: {
      groupTripId_travelerId: {
        groupTripId: group.groupTripId,
        travelerId,
      },
    },
    data: { status: 'LEFT', leftAt: new Date() },
  });
  await recordEvent(db, {
    tenantId,
    tripId,
    eventName: 'GROUP_COORDINATED',
    actorType: 'USER',
    actorId,
    payload: {
      groupTripId: group.groupTripId,
      action: 'participant_removed',
      travelerId,
    },
  });
  return participant;
}