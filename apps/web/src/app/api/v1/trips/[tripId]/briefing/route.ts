import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { viewBriefing } from '@/lib/domain/briefing';
export async function GET(request:NextRequest,{params}:{params:Promise<{tripId:string}>}){return safe(async()=>{const a=await actor();const {tripId}=await params;const slot=(new URL(request.url).searchParams.get('slot')??'morning') as any;if(!['morning','evening','pretrip_t24'].includes(slot))throw new Error('VALIDATION: invalid briefing slot');return ok(await viewBriefing(tripId,a.tenantId,a.actorId,slot));})}
