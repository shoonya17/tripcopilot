import { actor,safe } from '@/lib/route';import { ok } from '@/lib/http';import { listTrips } from '@/lib/domain/trips';
export async function GET(){return safe(async()=>{const a=await actor();return ok(await listTrips(a.tenantId,a.travelerId))})}
