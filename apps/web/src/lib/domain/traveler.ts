import crypto from 'node:crypto';
import { db } from '../db';

/**
 * Returns the traveler's ingest email token, creating one if it doesn't
 * exist. The token is the local part of their forwarding address.
 */
export async function getOrCreateIngestToken(
  travelerId: string,
  tenantId: string,
): Promise<string> {
  const traveler = await db.traveler.findFirst({
    where: { travelerId, tenantId },
  });
  if (!traveler) throw new Error('NOT_FOUND: traveler');

  if (traveler.ingestEmailToken) return traveler.ingestEmailToken;

  for (let attempt = 0; attempt < 5; attempt++) {
    const token = crypto.randomBytes(16).toString('hex');
    try {
      const updated = await db.traveler.update({
        where: { travelerId },
        data: { ingestEmailToken: token },
      });
      return updated.ingestEmailToken!;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('Unique constraint')) throw e;
    }
  }

  throw new Error('CONFLICT: could not generate unique ingest token');
}

/**
 * Looks up a traveler by ingest token. Used by the inbound email webhook.
 */
export async function findTravelerByIngestToken(token: string) {
  if (!token || token.length < 16) return null;
  return db.traveler.findFirst({
    where: { ingestEmailToken: token },
  });
}