import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { dismissConflict } from '@/lib/domain/conflicts';
import { claimIdempotency, completeIdempotency } from '@/lib/idempotency';
export async function POST(request:NextRequest,{params}:{params:Promise<{tripId:string;conflictId:string}>}){return safe(async()=>{const a=await actor();const p=await params;const body=await request.json().catch(()=>({}));const key=request.headers.get('Idempotency-Key');if(!key)throw new Error('VALIDATION:Idempotency-Key required');const payload={tripId:p.tripId,conflictId:p.conflictId,body};const prior=await claimIdempotency({tenantId:a.tenantId,key,payload});if(prior)return ok(prior);const result=await dismissConflict(p.tripId,p.conflictId,a.tenantId,a.actorId,body.reason);await completeIdempotency(a.tenantId,key,result);return ok(result)})}
