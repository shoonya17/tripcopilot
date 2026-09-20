import { actor,safe } from '@/lib/route';import { ok } from '@/lib/http';import { listDocuments } from '@/lib/domain/documents';
export async function GET(_:Request,{params}:{params:Promise<{tripId:string}>}){return safe(async()=>{const a=await actor();const {tripId}=await params;return ok(await listDocuments(tripId,a.tenantId))})}
