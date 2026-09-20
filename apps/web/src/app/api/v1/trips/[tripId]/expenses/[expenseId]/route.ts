import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { patchExpense } from '@/lib/domain/expenses';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tripId: string; expenseId: string }> }) {
  return safe(async () => {
    const a = await actor(); const p = await params; const body = await request.json();
    if (!Number.isInteger(body.row_version)) throw new Error('VALIDATION: row_version required');
    return ok(await patchExpense(p.tripId, p.expenseId, a.tenantId, a.actorId, body.row_version, body));
  });
}
