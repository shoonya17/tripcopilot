import { auth } from '@clerk/nextjs/server';
import crypto from 'node:crypto';
import { env } from './env';

export type ActorContext = { tenantId: string; travelerId: string; actorId: string; actorType: 'USER' | 'SYSTEM' | 'SUPPORT' };

function stableUuid(seed: string): string {
  const hex = crypto.createHash('sha256').update(seed).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

export async function getActorContext(): Promise<ActorContext> {
  if (env.DEV_AUTH_BYPASS) {
    return { tenantId: env.DEV_TENANT_ID, travelerId: env.DEV_TRAVELER_ID, actorId: env.DEV_TRAVELER_ID, actorType: 'USER' };
  }
  const { userId, orgId } = await auth();
  if (!userId) throw new Error('UNAUTHORIZED');
  const travelerId = stableUuid(`traveler:${userId}`);
  const tenantSeed = orgId ? `clerk-org:${orgId}` : `clerk-user:${userId}`;
  return { tenantId: stableUuid(tenantSeed), travelerId, actorId: travelerId, actorType: 'USER' };
}
