import { db } from '../db';
import { env } from '../env';
import { deleteSource, readSource, signedSourceUrl } from '../storage';

export async function listDocuments(tripId: string, tenantId: string) {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  return db.document.findMany({ where: { tripId, tenantId }, orderBy: { receivedAt: 'desc' } });
}
export async function getDocument(tripId: string, documentId: string, tenantId: string) {
  const d = await db.document.findFirst({ where: { tripId, documentId, tenantId } });
  if (!d) throw new Error('NOT_FOUND: document');
  return d;
}
export async function deleteDocument(tripId: string, documentId: string, tenantId: string) {
  const d = await getDocument(tripId, documentId, tenantId);
  await db.document.update({ where: { documentId }, data: { retentionState: 'PENDING_DELETION', rowVersion: { increment: 1 } } });
  return { documentId: d.documentId, retentionState: 'PENDING_DELETION' };
}
export async function documentContentUrl(tripId: string, documentId: string, tenantId: string) {
  const d = await getDocument(tripId, documentId, tenantId);
  const url = await signedSourceUrl(d.storageObjectKey);
  if (url) return { mode: 'SIGNED_URL' as const, url };
  return { mode: 'LOCAL_STREAM' as const, bytes: await readSource(d.storageObjectKey), contentType: 'application/pdf' };
}
export { deleteSource };
