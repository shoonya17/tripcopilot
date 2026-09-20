import Link from 'next/link';
import { actor } from '@/lib/route';
import { listTrips } from '@/lib/domain/trips';

export default async function HomePage() {
  const currentActor = await actor();
  const trips = await listTrips(currentActor.tenantId, currentActor.travelerId);
  return <main className="shell">
    <nav className="nav"><div className="brand">Trip Copilot</div><span className="pill">End-to-end v1</span></nav>
    <section className="hero"><h1>One wallet for the whole journey.</h1><p className="muted">Bring travel information together. Trip Copilot turns evidence into a structured trip, then gives you a fast Wallet, Right Now and Daily Briefing.</p></section>
    <div className="actions" style={{marginBottom:24}}><Link className="btn" href="/trips/new">Add a trip</Link>{trips[0] && <Link className="btn secondary" href={`/trips/${trips[0].tripId}`}>Open latest trip</Link>}</div>
    <section className="grid grid-2">{trips.map(t=><Link key={t.tripId} href={`/trips/${t.tripId}`} className="card"><div className="row"><strong>{t.title ?? 'Untitled trip'}</strong><span className="pill">{t.status}</span></div><p className="muted small">{t.segments.length} segments · {t.expenses.length} recent expenses · {t.conflicts.length} open conflicts</p></Link>)}{trips.length===0 && <div className="card"><h2 className="section-title">No trips yet</h2><p className="muted">Create your first trip from a booking, email, PDF, text or manual entry.</p></div>}</section>
  </main>
}
