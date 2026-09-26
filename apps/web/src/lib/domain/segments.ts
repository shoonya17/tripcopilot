import { db } from '../db';
import { recordEvent } from '../events';
import { recordAudit } from '../audit';
import { recomputeTripRelations } from './derived';

export async function deleteSegment(
  tripId: string,
  segmentId: string,
  tenantId: string,
  actorId: string,
) {
  const segment = await db.segment.findFirst({
    where: { segmentId, tripId, tenantId },
  });
  if (!segment) throw new Error('NOT_FOUND: segment');

  const trip = await db.trip.findFirst({
    where: { tripId, tenantId },
  });
  if (!trip) throw new Error('NOT_FOUND: trip');
  if (trip.ownerTravelerId !== actorId) throw new Error('FORBIDDEN');

  await db.$transaction(async (tx) => {
    // Delete connections referencing this segment. FKs may or may not
    // cascade depending on the schema; do it explicitly to be safe.
    await tx.connection.deleteMany({
      where: {
        tenantId,
        OR: [
          { fromSegmentId: segmentId },
          { toSegmentId: segmentId },
        ],
      },
    });

    // Delete provenance rows for this segment.
    await tx.fieldProvenance.deleteMany({
      where: {
        tenantId,
        entityType: 'SEGMENT',
        entityId: segmentId,
      },
    });

    // Delete the segment itself.
    await tx.segment.delete({
      where: { segmentId },
    });

    await recordAudit(tx, {
      tenantId,
      tripId,
      actorType: 'USER',
      actorId,
      action: 'SEGMENT_DELETED',
      entityType: 'SEGMENT',
      entityId: segmentId,
      metadata: {
        segmentType: segment.segmentType,
        supplierName: segment.supplierName,
      },
    });

    await recordEvent(tx, {
      tenantId,
      tripId,
      eventName: 'SEGMENT_DELETED',
      actorType: 'USER',
      actorId,
      behavioralClass: 'CORRECTION',
      payload: {
        segmentId,
        segmentType: segment.segmentType,
      },
    });
  });

  // Re-run conflict detection and connection inference. Without this,
  // a conflict created when more segments existed stays in the wallet
  // even after the segments it referenced are deleted.
  await recomputeTripRelations(tripId, tenantId);

  return { segmentId, deleted: true };
}