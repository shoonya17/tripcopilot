import { actor, body, safe } from '@/lib/route';
import { ok, created } from '@/lib/http';
import { ensureAccount } from '@/lib/domain/account';
export async function GET(){return safe(async()=>{const a=await actor();const account=await ensureAccount(a);return ok(account)})}
export async function POST(request:Request){return safe(async()=>{const a=await actor();const input=await request.json();const account=await ensureAccount(a,input);return created(account)})}
