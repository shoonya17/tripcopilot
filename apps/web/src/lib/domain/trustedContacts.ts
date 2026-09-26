import { db } from '../db';
import { recordEvent } from '../events';
import { recordAudit } from '../audit';

const ALLOWED_TYPES = new Set(['PHONE', 'EMAIL']);

export async function listTrustedContacts(
  travelerId: string,
  tenantId: string,
) {
  return db.trustedContact.findMany({
    where: { travelerId, tenantId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function addTrustedContact(
  travelerId: string,
  tenantId: string,
  actorId: string,
  input: { name: string; contactType: string; contactValue: string },
) {
  const name = (input.name ?? '').trim();
  const contactValue = (input.contactValue ?? '').trim();
  const contactType = (input.contactType ?? '').trim().toUpperCase();

  if (!name || name.length > 100) {
    throw new Error('VALIDATION: name is required and must be 1-100 chars');
  }
  if (!contactValue || contactValue.length > 200) {
    throw new Error('VALIDATION: contactValue is required and must be 1-200 chars');
  }
  if (!ALLOWED_TYPES.has(contactType)) {
    throw new Error('VALIDATION: contactType must be PHONE or EMAIL');
  }

  if (contactType === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue)) {
    throw new Error('VALIDATION: invalid email address');
  }
  if (contactType === 'PHONE' && !/^[+\d][\d\s\-()]{4,}$/.test(contactValue)) {
    throw new Error('VALIDATION: invalid phone number');
  }

  const traveler = await db.traveler.findFirst({
    where: { travelerId, tenantId },
  });
  if (!traveler) throw new Error('NOT_FOUND: traveler');

  // Prevent exact duplicates for the same traveler
  const existing = await db.trustedContact.findFirst({
    where: { travelerId, tenantId, contactType, contactValue },
  });
  if (existing) return existing;

  const created = await db.$transaction(async (tx) => {
    const row = await tx.trustedContact.create({
      data: { travelerId, tenantId, name, contactType, contactValue },
    });
    await recordAudit(tx, {
      tenantId,
      actorType: 'USER',
      actorId,
      action: 'TRUSTED_CONTACT_ADDED',
      entityType: 'TRUSTED_CONTACT',
      entityId: row.trustedContactId,
      metadata: { contactType },
    });
    await recordEvent(tx, {
      tenantId,
      eventName: 'TRUSTED_CONTACT_ADDED',
      actorType: 'USER',
      actorId,
      behavioralClass: 'REVIEW',
      payload: { trustedContactId: row.trustedContactId },
    });
    return row;
  });

  return created;
}

export async function removeTrustedContact(
  travelerId: string,
  tenantId: string,
  actorId: string,
  trustedContactId: string,
) {
  const existing = await db.trustedContact.findFirst({
    where: { trustedContactId, tenantId, travelerId },
  });
  if (!existing) throw new Error('NOT_FOUND: trusted contact');

  await db.$transaction(async (tx) => {
    await tx.trustedContact.delete({
      where: { trustedContactId },
    });
    await recordAudit(tx, {
      tenantId,
      actorType: 'USER',
      actorId,
      action: 'TRUSTED_CONTACT_REMOVED',
      entityType: 'TRUSTED_CONTACT',
      entityId: trustedContactId,
      metadata: { contactType: existing.contactType },
    });
    await recordEvent(tx, {
      tenantId,
      eventName: 'TRUSTED_CONTACT_REMOVED',
      actorType: 'USER',
      actorId,
      behavioralClass: 'CORRECTION',
      payload: { trustedContactId },
    });
  });

  return { trustedContactId, deleted: true };
}