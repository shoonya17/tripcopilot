import { actor,safe } from '@/lib/route';import { ok } from '@/lib/http';import { getRightNow } from '@/lib/domain/trips';
export async function GET(_:Request,{params}:{params:Promise<{tripId:string}>}){return safe(async()=>{const a=await actor();const {tripId}=await params;return ok(await getRightNow(tripId,a.tenantId,a.actorId))})}
