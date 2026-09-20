import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { created, ok } from '@/lib/http';
import { textIngestionSchema } from '@tripcopilot/core';
import { createIngestion } from '@/lib/domain/ingestion';
import { dispatchIngestion } from '@/lib/domain/ingestionRoutes';
import { claimIdempotency, completeIdempotency, requestHash } from '@/lib/idempotency';
export async function POST(request:NextRequest){return safe(async()=>{const a=await actor();const i=textIngestionSchema.parse(await request.json());const key=request.headers.get('Idempotency-Key');if(!key)throw new Error('VALIDATION:Idempotency-Key required');const payload={text:i.text,trip_id:i.trip_id,source_reference:i.source_reference};const prior=await claimIdempotency({tenantId:a.tenantId,key,payload});if(prior)return ok(prior);const ing=await createIngestion({tenantId:a.tenantId,travelerId:a.travelerId,channel:'TEXT',tripId:i.trip_id,rawText:i.text,sourceReference:i.source_reference,contentHash:requestHash(i.text),idempotencyKey:key});await dispatchIngestion(ing.ingestionId,a.tenantId);await completeIdempotency(a.tenantId,key,ing);return created(ing)})}
