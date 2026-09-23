import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { db } from '@/lib/db';
import { processIngestion } from '@/lib/domain/ingestion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ ingestionId: string }> },
) {
  return safe(async () => {
    const a = await actor();
    const { ingestionId } = await params;

    const ing = await db.ingestionRecord.findFirst({
      where: { ingestionId, tenantId: a.tenantId },
    });
    if (!ing) throw new Error('NOT_FOUND:ingestion');

    const result = await processIngestion(ingestionId, a.tenantId, {
      force: true,
    });

    return ok({
      ingestionId,
      productState: result?.productState ?? 'CONFIRMED',
      tripId: result?.tripId ?? null,
    });
  });
}