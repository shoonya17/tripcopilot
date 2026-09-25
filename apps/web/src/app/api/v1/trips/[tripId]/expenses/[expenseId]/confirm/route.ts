import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { confirmExpense } from '@/lib/domain/expenses';

export async function POST(request: NextRequest, { params }: { params: Promise<{ tripId: string; expenseId: string }> }) {
  return safe(async () => {
    const a = await actor(); const p = await params;
    const body = await request.json().catch(() => ({}));
    const rowVersion = Number(body?.row_version);
    if (!Number.isInteger(rowVersion) || rowVersion < 1) throw new Error('VALIDATION: row_version required');
    return ok(await confirmExpense(p.tripId, p.expenseId, a.tenantId, a.actorId, rowVersion));
  });
}