import crypto from 'node:crypto';
import { db } from './db';

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
}

export function requestHash(payload: unknown): string {
  return crypto.createHash('sha256').update(stable(payload)).digest('hex');
}

export function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function claimIdempotency(input: { tenantId: string; key: string; payload: unknown }) {
  const hash = requestHash(input.payload);
  if (!input.key.trim()) throw new Error('VALIDATION:Idempotency-Key required');

  const existing = await db.idempotencyRecord.findUnique({ where: { tenantId_key: { tenantId: input.tenantId, key: input.key } } });
  if (existing) {
    if (existing.requestHash !== hash) throw new Error('IDEMPOTENCY_KEY_REUSE');
    if ((existing.responseJson as any)?.status !== 'IN_PROGRESS') return existing.responseJson;
    throw new Error('IDEMPOTENCY_IN_PROGRESS');
  }

  try {
    await db.idempotencyRecord.create({ data: {
      tenantId: input.tenantId,
      key: input.key,
      requestHash: hash,
      responseJson: { status: 'IN_PROGRESS' },
    } });
  } catch {
    const again = await db.idempotencyRecord.findUnique({ where: { tenantId_key: { tenantId: input.tenantId, key: input.key } } });
    if (!again) throw new Error('IDEMPOTENCY_IN_PROGRESS');
    if (again.requestHash !== hash) throw new Error('IDEMPOTENCY_KEY_REUSE');
    if ((again.responseJson as any)?.status !== 'IN_PROGRESS') return again.responseJson;
    throw new Error('IDEMPOTENCY_IN_PROGRESS');
  }
  return null;
}

export async function completeIdempotency(tenantId: string, key: string, response: unknown) {
  return db.idempotencyRecord.update({
    where: { tenantId_key: { tenantId, key } },
    data: { responseJson: jsonSafe(response) as any },
  });
}
