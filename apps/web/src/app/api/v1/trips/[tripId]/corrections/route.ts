import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { applyCorrection } from '@/lib/domain/corrections';
import { claimIdempotency, completeIdempotency } from '@/lib/idempotency';

export async function POST(request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  return safe(async () => {
    const a = await actor(); const { tripId } = await params; const payload = await request.json(); const key = request.headers.get('Idempotency-Key');
    if (!key) throw new Error('VALIDATION:Idempotency-Key required');
    const prior = await claimIdempotency({ tenantId: a.tenantId, key, payload: { tripId, payload } }); if (prior) return ok(prior);
    const result = await applyCorrection(tripId, a.tenantId, a.actorId, payload); await completeIdempotency(a.tenantId, key, result); return ok(result);
  });
}
