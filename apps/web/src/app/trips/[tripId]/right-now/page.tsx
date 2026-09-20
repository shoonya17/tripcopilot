import Link from 'next/link';
import { getActorContext } from '@/lib/auth';
import { getRightNow } from '@/lib/domain/trips';
export default async function RightNowPage({params}:{params:Promise<{tripId:string}>}){const a=await getActorContext();const {tripId}=await params;const v=await getRightNow(tripId,a.tenantId,a.actorId);return <main className="shell"><Link href={`/trips/${tripId}`}>← Trip Wallet</Link><section className="hero"><p className="small muted">RIGHT NOW</p><h1>{v.nextThing??'No upcoming segment'}</h1><p className="muted">{v.address??'No address'} · {v.time??'No time'}</p>{v.bookingReference&&<div className="pill">{v.bookingReference}</div>}</section></main>}
