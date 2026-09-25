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
    if (!key) throw new Error('VALIDATION:Idempotency-Key required');

    const form = await request.formData();
    const file = form.get('file');
    const clientTripId = form.get('tripId');

    if (!(file instanceof File)) {
      throw new Error('VALIDATION:file required');
    }

    const allowed = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    if (!allowed.has(file.type)) {
      throw new Error(
        'VALIDATION:unsupported image type — use JPEG, PNG or WebP',
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error('VALIDATION:file too large (10MB max)');
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    const isJpeg =
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;
    const isWebp =
      bytes.slice(0, 4).toString() === 'RIFF' &&
      bytes.slice(8, 12).toString() === 'WEBP';

    if (!isJpeg && !isPng && !isWebp) {
      throw new Error('VALIDATION:invalid image signature');
    }

    const contentHash = requestHash(bytes.toString('base64'));

    const payload = {
      name: file.name,
      type: file.type,
      size: file.size,
      contentHash,
    };

    const prior = await claimIdempotency({
      tenantId: a.tenantId,
      key,
      payload,
    });
    if (prior) return ok(prior);

    const existingDoc = await db.document.findFirst({
      where: { tenantId: a.tenantId, contentHash },
      orderBy: { version: 'desc' },
    });

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
        documentId = existingDoc.documentId;
      } else {
        const doc = await tx.document.create({
          data: {
            tenantId: a.tenantId,
            sourceType: 'IMAGE',
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

      const ing = await tx.ingestionRecord.create({
        data: {
          tenantId: a.tenantId,
          travelerId: a.travelerId,
          channel: 'IMAGE',
          sourceReference: file.name,
          receivedAt: new Date(),
          productState: 'RECEIVED',
          securityState: 'CLEARED',
          implementationState: 'RECEIVED',
          contentHash,
          documentId,
          rawText: null,
          idempotencyKey: key,
          tripId:
            (typeof clientTripId === 'string' && clientTripId) ||
            existingDoc?.tripId ||
            undefined,
        },
      });

      return { ingestionId: ing.ingestionId, documentId };
    });

    await completeIdempotency(a.tenantId, key, result);

    dispatchIngestion(result.ingestionId, a.tenantId).catch((err) => {
      console.error('[image] background processing failed', err);
    });

    return created(result);
  });
}