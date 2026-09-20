import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { getBudget, putBudget } from '@/lib/domain/budget';
import { claimIdempotency, completeIdempotency } from '@/lib/idempotency';

export async function GET(_: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return safe(async () => { const a = await actor(); const { tripId } = await params; return ok(await getBudget(tripId, a.tenantId)); });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  return safe(async () => {
    const a = await actor(); const { tripId } = await params; const body = await request.json();
    const key = request.headers.get('Idempotency-Key'); if (!key) throw new Error('VALIDATION:Idempotency-Key required');
    const prior = await claimIdempotency({ tenantId: a.tenantId, key, payload: { tripId, body } }); if (prior) return ok(prior);
    const result = await putBudget(tripId, a.tenantId, a.actorId, body); await completeIdempotency(a.tenantId, key, result); return ok(result);
  });
}
