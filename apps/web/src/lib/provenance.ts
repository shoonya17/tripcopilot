import { db } from './db';

export async function writeProvenance(tx: any, input: {
  tenantId: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  sourceKind: string;
  sourceId?: string;
  sourceVersion?: number;
  sourceExcerpt?: string;
  extractedBy?: string;
  confidence?: number;
  isUserOriginated?: boolean;
  userActorId?: string;
}) {
  return tx.fieldProvenance.create({ data: {
    tenantId: input.tenantId,
    entityType: input.entityType,
    entityId: input.entityId,
    fieldName: input.fieldName,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    sourceVersion: input.sourceVersion,
    sourceExcerpt: input.sourceExcerpt,
    extractedBy: input.extractedBy,
    confidence: input.confidence,
    isUserOriginated: input.isUserOriginated ?? false,
    userActorId: input.userActorId,
  }});
}
