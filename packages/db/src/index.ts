import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __tripcopilot_prisma: PrismaClient | undefined;
}

export const db = globalThis.__tripcopilot_prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__tripcopilot_prisma = db;
export * from '@prisma/client';
