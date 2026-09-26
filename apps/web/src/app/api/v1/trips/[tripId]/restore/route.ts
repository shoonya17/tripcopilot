import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { restoreTrip } from '@/lib/domain/trips';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  return safe(async () => {
    const a = await actor();
    const { tripId } = await params;
    return ok(await restoreTrip(tripId, a.tenantId, a.actorId));
  });
}