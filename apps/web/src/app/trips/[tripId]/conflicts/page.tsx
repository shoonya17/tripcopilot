import Link from 'next/link';
import { getActorContext } from '@/lib/auth';
import { listConflicts } from '@/lib/domain/conflicts';
export default async function ConflictsPage({params}:{params:Promise<{tripId:string}>}){const a=await getActorContext();const {tripId}=await params;const conflicts=await listConflicts(tripId,a.tenantId);return <main className="shell"><Link href={`/trips/${tripId}`}>← Trip Wallet</Link><section className="hero"><h1>Conflicts</h1><p className="muted">Dismissal is an event, not a resolved state.</p></section><div className="list">{conflicts.map((c:any)=><div className="card" key={c.conflictId}><div className="row"><strong>{c.conflictType}</strong><span className="pill">{c.status}</span></div><p>{c.summary}</p></div>)}</div></main>}
