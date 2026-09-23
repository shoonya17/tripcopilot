import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { created, ok } from '@/lib/http';
import { db } from '@/lib/db';
import { putSource } from '@/lib/storage';
import { dispatchIngestion } from '@/lib/domain/ingestionRoutes';
import {
  claimIdempotency,
  completeIdempotency,
  requestHash,
} from '@/lib/idempotency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return safe(async () => {
    const a = await actor();

    const key = request.headers.get('Idempotency-Key');
    if (!key) {
      throw new Error('VALIDATION:Idempotency-Key required');
    }

    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      throw new Error('VALIDATION:file required');
    }

    if (file.type !== 'application/pdf') {
      throw new Error('VALIDATION:PDF required');
    }

    if (file.size > 15 * 1024 * 1024) {
      throw new Error('VALIDATION:file too large');
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    if (bytes.subarray(0, 5).toString() !== '%PDF-') {
      throw new Error('VALIDATION:invalid PDF signature');
    }

    const contentHash = requestHash(bytes.toString('base64'));

    const payload = {
      name: file.name,
      type: file.type,
      size: file.size,
      contentHash,
    };

    // Idempotency: if this exact request already completed, return cached result.
    const prior = await claimIdempotency({
      tenantId: a.tenantId,
      key,
      payload,
    });

    if (prior) {
      return ok(prior);
    }

    // Block 3 v1.2 §24 — dedup by content hash BEFORE any storage / parse / create.
    const existingDoc = await db.document.findFirst({
      where: {
        tenantId: a.tenantId,
        contentHash,
      },
      orderBy: { version: 'desc' },
    });

    // Store bytes only if new; reuse storage key if existing already has one.
    let storageKey: string;
    if (existingDoc?.storageObjectKey) {
      storageKey = existingDoc.storageObjectKey;
    } else {
      const stored = await putSource(bytes, file.type);
      storageKey = stored.key;
    }

    const result = await db.$transaction(async (tx) => {
      let documentId: string;

      if (existingDoc) {
        // Duplicate — reuse existing document. Do not create a new row.
        documentId = existingDoc.documentId;
      } else {
        // New document — create v1.
        const doc = await tx.document.create({
          data: {
            tenantId: a.tenantId,
            sourceType: 'PDF',
            sourceReference: file.name,
            storageObjectKey: storageKey,
            receivedAt: new Date(),
            contentHash,
            version: 1,
            retentionState: 'ACTIVE',
            securityState: 'CLEARED',
          },
        });
        documentId = doc.documentId;
      }

      const parser = await import('pdf-parse');
      const parsed = await parser.default(bytes);

      const ing = await tx.ingestionRecord.create({
        data: {
          tenantId: a.tenantId,
          travelerId: a.travelerId,
          channel: 'PDF',
          sourceReference: file.name,
          receivedAt: new Date(),
          productState: 'RECEIVED',
          securityState: 'CLEARED',
          implementationState: 'RECEIVED',
          contentHash,
          documentId,
          rawText: parsed.text,
          idempotencyKey: key,
        },
      });

      return { ingestionId: ing.ingestionId, documentId };
    });

    // Mark idempotency BEFORE dispatching so a repeat request returns fast.
    await completeIdempotency(a.tenantId, key, result);

    // Fire-and-forget: return to the client immediately; AI runs in the
    // background. The processing page polls for state changes.
    dispatchIngestion(result.ingestionId, a.tenantId).catch((err) => {
      console.error('[pdf] background processing failed', err);
    });

    return created(result);
  });
}