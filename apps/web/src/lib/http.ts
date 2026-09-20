import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function ok(data: unknown, status = 200) { return NextResponse.json({ data }, { status }); }
export function created(data: unknown) { return NextResponse.json({ data }, { status: 201 }); }
export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Internal error';
  const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' || message.startsWith('FORBIDDEN:') ? 403 : message.startsWith('NOT_FOUND') ? 404 : message.startsWith('CONFLICT') || message.startsWith('STALE_VERSION') || message.startsWith('IDEMPOTENCY_') ? 409 : message.startsWith('VALIDATION') || error instanceof ZodError ? 400 : 500;
  return NextResponse.json({ error: { code: message.split(':')[0], message } }, { status });
}
