import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { deleteTripPermanently } from '@/lib/domain/trips';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  return safe(async () => {
    const a = await actor();
    const { tripId } = await params;
    return ok(
      await deleteTripPermanently(tripId, a.tenantId, a.actorId),
    );
  });
}