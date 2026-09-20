import { db } from '../db';
import type { ActorContext } from '../auth';

export async function ensureAccount(actor: ActorContext, profile?: { name?: string; email?: string; phone?: string; locale?: string; timezone?: string }) {
  const bySubject = !process.env.DEV_AUTH_BYPASS;
  if (bySubject) {
    return db.traveler.upsert({
      where: { authSubject: actor.actorId },
      update: { displayName: profile?.name, email: profile?.email, phone: profile?.phone, locale: profile?.locale, defaultTimezone: profile?.timezone },
      create: { travelerId: actor.travelerId, authSubject: actor.actorId, tenantId: actor.tenantId, displayName: profile?.name, email: profile?.email, phone: profile?.phone, locale: profile?.locale, defaultTimezone: profile?.timezone ?? 'UTC' },
    });
  }
  return db.traveler.upsert({
    where: { travelerId: actor.travelerId },
    update: { displayName: profile?.name, email: profile?.email, phone: profile?.phone, locale: profile?.locale, defaultTimezone: profile?.timezone },
    create: { travelerId: actor.travelerId, tenantId: actor.tenantId, displayName: profile?.name, email: profile?.email, phone: profile?.phone, locale: profile?.locale, defaultTimezone: profile?.timezone ?? 'UTC' },
  });
}
