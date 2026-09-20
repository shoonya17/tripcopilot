import crypto from 'node:crypto';
import type { ActorType } from '@prisma/client';

export async function recordAudit(tx: any, input: {
  tenantId: string;
  tripId?: string;
  actorType: ActorType;
  actorId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: unknown;
  requestId?: string;
}) {
  return tx.auditLog.create({ data: {
    tenantId: input.tenantId,
    tripId: input.tripId,
    actorType: input.actorType,
    actorId: input.actorId,
    action: input.action,
    requestId: input.requestId ?? crypto.randomUUID(),
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata as any,
  } });
}
