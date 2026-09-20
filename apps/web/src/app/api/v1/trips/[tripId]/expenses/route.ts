import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok, created } from '@/lib/http';
import { listExpenses, createExpense } from '@/lib/domain/expenses';
import { claimIdempotency, completeIdempotency } from '@/lib/idempotency';

export async function GET(request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  return safe(async () => {
    const a = await actor(); const { tripId } = await params; const u = new URL(request.url);
    const page = Number(u.searchParams.get('page') ?? 1); const pageSize = Number(u.searchParams.get('page_size') ?? 25);
    return ok(await listExpenses(tripId, a.tenantId, { travelerId: u.searchParams.get('traveler_id') ?? undefined, category: u.searchParams.get('category') ?? undefined, from: u.searchParams.get('from') ?? undefined, to: u.searchParams.get('to') ?? undefined, page, pageSize }));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  return safe(async () => {
    const a = await actor(); const { tripId } = await params; const payload = await request.json(); const key = request.headers.get('Idempotency-Key');
    if (!key) throw new Error('VALIDATION:Idempotency-Key required');
    const prior = await claimIdempotency({ tenantId: a.tenantId, key, payload: { tripId, ...payload } });
    if (prior) return ok(prior);
    const result = await createExpense(tripId, a.tenantId, a.actorId, payload);
    await completeIdempotency(a.tenantId, key, result);
    return created(result);
  });
}
