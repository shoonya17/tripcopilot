import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { deleteSegment } from '@/lib/domain/segments';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string; segmentId: string }> },
) {
  return safe(async () => {
    const a = await actor();
    const p = await params;
    return ok(
      await deleteSegment(p.tripId, p.segmentId, a.tenantId, a.actorId),
    );
  });
}