import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { created, ok } from '@/lib/http';
import { db } from '@/lib/db';
import { putSource } from '@/lib/storage';
import { dispatchIngestion } from '@/lib/domain/ingestionRoutes';
import { claimIdempotency, completeIdempotency, requestHash } from '@/lib/idempotency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return safe(async () => {
    const a = await actor();
    const key = request.headers.get('Idempotency-Key'); if (!key) throw new Error('VALIDATION:Idempotency-Key required');
    const form = await request.formData(); const file = form.get('file');
    if (!(file instanceof File)) throw new Error('VALIDATION:file required');
    if (file.type !== 'application/pdf') throw new Error('VALIDATION:PDF required');
    if (file.size > 15 * 1024 * 1024) throw new Error('VALIDATION:file too large');
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('VALIDATION:invalid PDF signature');
    const contentHash = requestHash(bytes.toString('base64'));
    const payload = { name:file.name, type:file.type, size:file.size, contentHash };
    const prior = await claimIdempotency({ tenantId: a.tenantId, key, payload }); if (prior) return ok(prior);
    const stored = await putSource(bytes, file.type);
    const parser = await import('pdf-parse');
    const parsed = await parser.default(bytes);
    const doc = await db.document.create({ data: { tenantId:a.tenantId, sourceType:'PDF', sourceReference:file.name, storageObjectKey:stored.key, receivedAt:new Date(), contentHash:stored.hash, version:1, retentionState:'ACTIVE', securityState:'CLEARED' } });
    const ing = await db.ingestionRecord.create({ data: { tenantId:a.tenantId, travelerId:a.travelerId, channel:'PDF', sourceReference:file.name, receivedAt:new Date(), productState:'RECEIVED', securityState:'CLEARED', implementationState:'RECEIVED', contentHash:stored.hash, documentId:doc.documentId, rawText:parsed.text, idempotencyKey:key } });
    await dispatchIngestion(ing.ingestionId,a.tenantId);
    const result = { ingestionId:ing.ingestionId, documentId:doc.documentId };
    await completeIdempotency(a.tenantId,key,result);
    return created(result);
  });
}
