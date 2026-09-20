import { db } from '../db';
import { recordEvent } from '../events';

export async function getSafety(tripId: string, tenantId: string) {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId }, select: { ownerTravelerId: true } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  const [contacts, shares, consent] = await Promise.all([
    db.trustedContact.findMany({ where: { tenantId, travelerId: trip.ownerTravelerId }, orderBy: { createdAt: 'asc' } }),
    db.safetyCheckin.findMany({ where: { tripId, tenantId }, orderBy: { sharedAt: 'desc' }, take: 10 }),
    db.consent.findFirst({ where: { tenantId, travelerId: trip.ownerTravelerId, tripId, consentType: 'SAFETY' }, orderBy: { updatedAt: 'desc' } }),
  ]);
  return { contacts, shares, consent };
}

export async function setSafetyConsent(input: { tripId: string; tenantId: string; travelerId: string; actorId: string; granted: boolean }) {
  const trip = await db.trip.findFirst({ where: { tripId: input.tripId, tenantId: input.tenantId } });
  if (!trip || trip.ownerTravelerId !== input.travelerId) throw new Error('FORBIDDEN');
  const current = await db.consent.findFirst({ where: { tenantId: input.tenantId, travelerId: input.travelerId, tripId: input.tripId, consentType: 'SAFETY' }, orderBy: { updatedAt: 'desc' } });
  return db.$transaction(async tx => {
    let next;
    if (current?.status === 'WITHDRAWN' && input.granted) {
      next = await tx.consent.create({ data: { tenantId: input.tenantId, travelerId: input.travelerId, tripId: input.tripId, consentType: 'SAFETY', status: 'GRANTED', grantedAt: new Date(), withdrawnAt: null } });
    } else if (current) {
      if (current.status === 'WITHDRAWN' && !input.granted) return current;
      next = await tx.consent.update({ where: { consentId: current.consentId }, data: input.granted ? { status: 'GRANTED', grantedAt: current.grantedAt ?? new Date(), withdrawnAt: null } : { status: 'WITHDRAWN', withdrawnAt: new Date() } });
    } else {
      next = await tx.consent.create({ data: { tenantId: input.tenantId, travelerId: input.travelerId, tripId: input.tripId, consentType: 'SAFETY', status: input.granted ? 'GRANTED' : 'WITHDRAWN', grantedAt: input.granted ? new Date() : null, withdrawnAt: input.granted ? null : new Date() } });
    }
    await recordEvent(tx, { tenantId: input.tenantId, tripId: input.tripId, eventName: input.granted ? 'CONSENT_GRANTED' : 'CONSENT_WITHDRAWN', actorType: 'USER', actorId: input.actorId, payload: { consentId: next.consentId, consentType: 'SAFETY' } });
    return next;
  });
}

export async function shareLocation(input: { tripId: string; tenantId: string; travelerId: string; actorId: string; lat: number; long: number; accuracy?: number; consentReference?: string }) {
  const trip = await db.trip.findFirst({ where: { tripId: input.tripId, tenantId: input.tenantId } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  if (trip.ownerTravelerId !== input.travelerId) throw new Error('FORBIDDEN');
  if (!input.consentReference) throw new Error('FORBIDDEN: valid granted safety consent required');
  const consent = await db.consent.findFirst({ where: { consentId: input.consentReference, tenantId: input.tenantId, travelerId: input.travelerId, tripId: input.tripId, status: 'GRANTED', consentType: 'SAFETY' } });
  if (!consent) throw new Error('FORBIDDEN: valid granted safety consent required');
  const checkin = await db.safetyCheckin.create({ data: { tenantId: input.tenantId, tripId: input.tripId, travelerId: input.travelerId, sharedAt: new Date(), locationLat: input.lat, locationLong: input.long, locationAccuracyM: input.accuracy, consentReference: input.consentReference } });
  await recordEvent(db, { tenantId: input.tenantId, tripId: input.tripId, eventName: 'SAFETY_INTERACTED', actorType: 'USER', actorId: input.actorId, payload: { safetyCheckinId: checkin.safetyCheckinId } });
  return checkin;
}


export async function addTrustedContact(input: { tripId: string; tenantId: string; travelerId: string; actorId: string; name: string; contactValue: string; contactType: string }) {
  const trip = await db.trip.findFirst({ where: { tripId: input.tripId, tenantId: input.tenantId } });
  if (!trip || trip.ownerTravelerId !== input.travelerId) throw new Error('FORBIDDEN');
  const contact = await db.trustedContact.create({ data: { tenantId: input.tenantId, travelerId: input.travelerId, name: input.name, contactValue: input.contactValue, contactType: input.contactType } });
  await recordEvent(db, { tenantId: input.tenantId, tripId: input.tripId, eventName: 'TRUSTED_CONTACT_UPDATED', actorType: 'USER', actorId: input.actorId, payload: { trustedContactId: contact.trustedContactId, action: 'created' } });
  return contact;
}

export async function removeTrustedContact(input: { tripId: string; tenantId: string; travelerId: string; actorId: string; trustedContactId: string; rowVersion: number }) {
  const trip = await db.trip.findFirst({ where: { tripId: input.tripId, tenantId: input.tenantId } });
  if (!trip || trip.ownerTravelerId !== input.travelerId) throw new Error('FORBIDDEN');
  const contact = await db.trustedContact.findFirst({ where: { trustedContactId: input.trustedContactId, tenantId: input.tenantId, travelerId: input.travelerId } });
  if (!contact) throw new Error('NOT_FOUND: trusted contact');
  if (contact.rowVersion !== input.rowVersion) throw new Error('STALE_VERSION: trusted contact');
  await db.trustedContact.delete({ where: { trustedContactId: contact.trustedContactId } });
  await recordEvent(db, { tenantId: input.tenantId, tripId: input.tripId, eventName: 'TRUSTED_CONTACT_UPDATED', actorType: 'USER', actorId: input.actorId, payload: { trustedContactId: contact.trustedContactId, action: 'deleted' } });
  return { trustedContactId: contact.trustedContactId, deleted: true };
}
