import { NextRequest } from 'next/server';
import { getActorContext } from './auth';
import { ensureAccount } from './domain/account';
import { errorResponse } from './http';

export async function actor() {
  const context = await getActorContext();
  await ensureAccount(context);
  return context;
}

export async function body<T>(request: NextRequest): Promise<T> {
  return (await request.json()) as T;
}

export async function safe(handler: () => Promise<Response>) {
  try {
    return await handler();
  } catch (e) {
    return errorResponse(e);
  }
}
