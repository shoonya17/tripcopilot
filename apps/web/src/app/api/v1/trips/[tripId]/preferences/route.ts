import { actor,safe } from '@/lib/route';import { ok } from '@/lib/http';import { getTripPreferences } from '@/lib/domain/preferences';
export async function GET(_:Request,{params}:{params:Promise<{tripId:string}>}){return safe(async()=>{const a=await actor();const {tripId}=await params;return ok(await getTripPreferences(tripId,a.tenantId))})}
