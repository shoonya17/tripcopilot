import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { getTrip, updateTrip, archiveTrip } from '@/lib/domain/trips';

export async function GET(_: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  return safe(async () => { const a = await actor(); const { tripId } = await params; return ok(await getTrip(tripId, a.tenantId)); });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  return safe(async () => {
    const a = await actor(); const { tripId } = await params; const input = await request.json();
    if (!Number.isInteger(input.row_version)) throw new Error('VALIDATION: row_version required');
    return ok(await updateTrip(tripId, a.tenantId, a.actorId, input.row_version, input));
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  return safe(async () => {
    const a = await actor();
    const { tripId } = await params;
    const body = await request.json().catch(() => ({}));
    const rowVersion = Number(body?.row_version);
    if (!Number.isInteger(rowVersion) || rowVersion < 1) throw new Error('VALIDATION: row_version required');
    const trip = await archiveTrip(tripId, a.tenantId, a.travelerId, rowVersion);
    return ok({ tripId: trip.tripId, status: trip.status });
  });
}
