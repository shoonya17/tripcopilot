import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { upsertPreference } from '@/lib/domain/preferences';
import { claimIdempotency, completeIdempotency } from '@/lib/idempotency';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ tripId: string; preferenceKey: string }> }) {
  return safe(async () => {
    const a = await actor(); const p = await params; const body = await request.json(); const key = request.headers.get('Idempotency-Key');
    if (!key) throw new Error('VALIDATION:Idempotency-Key required');
    if (body.row_version == null && body.value === undefined) throw new Error('VALIDATION: value required');
    const payload = { tripId: p.tripId, preferenceKey: p.preferenceKey, body };
    const prior = await claimIdempotency({ tenantId: a.tenantId, key, payload }); if (prior) return ok(prior);
    const result = await upsertPreference({ tenantId: a.tenantId, travelerId: a.travelerId, tripId: p.tripId, scope: 'TRIP', key: decodeURIComponent(p.preferenceKey), value: body.value, rowVersion: body.row_version, actorId: a.actorId });
    await completeIdempotency(a.tenantId, key, result); return ok(result);
  });
}
