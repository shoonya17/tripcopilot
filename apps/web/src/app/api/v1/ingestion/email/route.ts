import { NextRequest } from 'next/server';
import { safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { db } from '@/lib/db';
import { putSource } from '@/lib/storage';
import { dispatchIngestion } from '@/lib/domain/ingestionRoutes';
import { findTravelerByIngestToken } from '@/lib/domain/traveler';
import {
  claimIdempotency,
  completeIdempotency,
  requestHash,
} from '@/lib/idempotency';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTACHMENTS = 10;
const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function extractTokenFromAddress(addr: string): string | null {
  if (!addr) return null;
  const cleaned = addr.replace(/^.*</, '').replace(/>.*$/, '').trim();
  const at = cleaned.indexOf('@');
  if (at <= 0) return null;
  return cleaned.slice(0, at).toLowerCase();
}

function isAllowedMime(contentType: string, name: string): boolean {
  if (ALLOWED_TYPES.has(contentType)) return true;
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return true;
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return true;
  if (lower.endsWith('.png')) return true;
  if (lower.endsWith('.webp')) return true;
  return false;
}

function detectPdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 5).toString() === '%PDF-';
}

function detectImageMime(bytes: Buffer): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.slice(0, 4).toString() === 'RIFF' &&
    bytes.slice(8, 12).toString() === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export async function POST(request: NextRequest) {
  return safe(async () => {
    if (env.POSTMARK_WEBHOOK_SECRET) {
      const auth = request.headers.get('authorization') ?? '';
      const expected =
        'Basic ' +
        Buffer.from(env.POSTMARK_WEBHOOK_SECRET).toString('base64');
      if (auth !== expected) {
        throw new Error('FORBIDDEN: invalid webhook credentials');
      }
    }

    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      throw new Error('VALIDATION: invalid webhook payload');
    }

    const toFull =
      (payload as any)?.ToFull?.[0]?.Email ??
      (payload as any)?.To ??
      '';
    const token = extractTokenFromAddress(String(toFull));
    if (!token) {
      throw new Error('VALIDATION: no recipient address');
    }

    const traveler = await findTravelerByIngestToken(token);
    if (!traveler) {
      throw new Error('NOT_FOUND: unknown ingest address');
    }

    const attachments = Array.isArray((payload as any)?.Attachments)
      ? (payload as any).Attachments
      : [];

    if (attachments.length === 0) {
      return ok({ received: true, ingested: 0, reason: 'no attachments' });
    }

    const messageId = String((payload as any)?.MessageID ?? '');
    const results: Array<{ ingestionId: string; documentId: string }> = [];

    for (let i = 0; i < attachments.length && i < MAX_ATTACHMENTS; i++) {
      const att = attachments[i];
      const name = String(att?.Name ?? `attachment-${i}`);
      const contentType = String(att?.ContentType ?? '');

      if (!isAllowedMime(contentType, name)) continue;

      const content = att?.Content;
      if (typeof content !== 'string') continue;

      const bytes = Buffer.from(content, 'base64');
      if (bytes.length === 0 || bytes.length > MAX_BYTES) continue;

      const isPdf = detectPdf(bytes);
      const imageMime = isPdf ? null : detectImageMime(bytes);
      if (!isPdf && !imageMime) continue;

      const contentHash = requestHash(bytes.toString('base64'));
      const idempotencyKey = `${messageId}:${i}:${contentHash}`;

      const prior = await claimIdempotency({
        tenantId: traveler.tenantId,
        key: idempotencyKey,
        payload: { name, size: bytes.length, contentHash },
      });
      if (prior) continue;

      const stored = await putSource(
        bytes,
        isPdf ? 'application/pdf' : imageMime!,
      );

      const result = await db.$transaction(async (tx) => {
        const doc = await tx.document.create({
          data: {
            tenantId: traveler.tenantId,
            sourceType: 'EMAIL_ATTACHMENT',
            sourceReference: name,
            storageObjectKey: stored.key,
            receivedAt: new Date(),
            contentHash,
            version: 1,
            retentionState: 'ACTIVE',
            securityState: 'CLEARED',
          },
        });

        const ing = await tx.ingestionRecord.create({
          data: {
            tenantId: traveler.tenantId,
            travelerId: traveler.travelerId,
            channel: isPdf ? 'EMAIL' : 'IMAGE',
            sourceReference: name,
            receivedAt: new Date(),
            productState: 'RECEIVED',
            securityState: 'CLEARED',
            implementationState: 'RECEIVED',
            contentHash,
            documentId: doc.documentId,
            rawText: null,
            idempotencyKey,
          },
        });

        return { ingestionId: ing.ingestionId, documentId: doc.documentId };
      });

      await completeIdempotency(traveler.tenantId, idempotencyKey, result);

      dispatchIngestion(result.ingestionId, traveler.tenantId).catch((err) => {
        console.error('[email] background processing failed', err);
      });

      results.push(result);
    }

    return ok({ received: true, ingested: results.length });
  });
}