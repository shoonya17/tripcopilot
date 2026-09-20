import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { created, ok } from '@/lib/http';
import { manualIngestionSchema } from '@tripcopilot/core';
import { createIngestion } from '@/lib/domain/ingestion';
import { dispatchIngestion } from '@/lib/domain/ingestionRoutes';
import { claimIdempotency, completeIdempotency, requestHash } from '@/lib/idempotency';
export async function POST(request:NextRequest){return safe(async()=>{const a=await actor();const i=manualIngestionSchema.parse(await request.json());const key=request.headers.get('Idempotency-Key');if(!key)throw new Error('VALIDATION:Idempotency-Key required');const payload=i.structured_trip??{source_text:i.source_text};const prior=await claimIdempotency({tenantId:a.tenantId,key,payload});if(prior)return ok(prior);const ing=await createIngestion({tenantId:a.tenantId,travelerId:a.travelerId,channel:'MANUAL',tripId:i.trip_id,rawText:i.structured_trip?`TRIP_COPILOT_MANUAL_JSON:${JSON.stringify(i.structured_trip)}`:i.source_text,sourceReference:i.structured_trip?'manual-structured':'manual',contentHash:requestHash(payload),idempotencyKey:key});await dispatchIngestion(ing.ingestionId,a.tenantId);await completeIdempotency(a.tenantId,key,ing);return created(ing)})}
