import Link from 'next/link';
import { getTrip, getRightNow, getTimeline } from '@/lib/domain/trips';
import { getBudget } from '@/lib/domain/budget';
import { listExpenses } from '@/lib/domain/expenses';
import { listDocuments } from '@/lib/domain/documents';
import { listConflicts } from '@/lib/domain/conflicts';
import { getSafety } from '@/lib/domain/safety';
import { getGroup } from '@/lib/domain/group';
import { getEffectivePreferences } from '@/lib/domain/preferences';
import { getActorContext } from '@/lib/auth';
import TripActions from '@/components/TripActions';
import { recordEvent } from '@/lib/events';
import { db } from '@/lib/db';

function money(amount: unknown, currency: string) { return `${currency} ${Number(amount).toFixed(2)}`; }
function date(value: Date | null | undefined, timezone?: string | null) { if (!value) return '—'; return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:timezone || undefined}).format(value); }

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const a = await getActorContext();
  const { tripId } = await params;
  const trip = await getTrip(tripId, a.tenantId);
  if (trip.ownerTravelerId !== a.travelerId) throw new Error('FORBIDDEN');
  await recordEvent(db, { tenantId:a.tenantId, tripId, eventName:'WALLET_REOPENED', actorType:'USER', actorId:a.actorId, behavioralClass:'RETRIEVAL', payload:{source:'wallet'} });
  const [rightNow, timeline, budget, expensePage, documents, conflicts, safety, group, preferences] = await Promise.all([
    getRightNow(tripId, a.tenantId), getTimeline(tripId, a.tenantId, a.actorId), getBudget(tripId, a.tenantId), listExpenses(tripId, a.tenantId,{page:1,pageSize:20}), listDocuments(tripId,a.tenantId), listConflicts(tripId,a.tenantId), getSafety(tripId,a.tenantId), getGroup(tripId,a.tenantId), getEffectivePreferences(tripId,a.tenantId,a.travelerId),
  ]);
  const budgetTotal = budget.reduce((s,b)=>s+Number(b.plannedAmount),0);
  const expenseTotal = expensePage.items.reduce((s,e)=>s+Number(e.amount),0);
  const firstSegment = trip.segments.find((s:any)=>s.departureUtc); const lastSegment = [...trip.segments].reverse().find((s:any)=>s.arrivalUtc);
  const googleStart = firstSegment?.departureUtc ? new Date(firstSegment.departureUtc).toISOString().replace(/[-:]/g,'').replace(/\.000Z$/,'Z') : '';
  const googleEnd = lastSegment?.arrivalUtc ? new Date(lastSegment.arrivalUtc).toISOString().replace(/[-:]/g,'').replace(/\.000Z$/,'Z') : googleStart;
  const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(trip.title ?? 'Trip Copilot trip')}&details=${encodeURIComponent('Trip Copilot calendar export')}${googleStart?`&dates=${googleStart}/${googleEnd}`:''}`;
  return <main className="shell">
    <nav className="nav"><Link href="/">← Wallets</Link><div className="actions"><span className="pill">{trip.status}</span><a className="btn secondary" href={`/api/v1/trips/${tripId}/calendar.ics`}>ICS</a><a className="btn secondary" href={googleLink} target="_blank" rel="noreferrer">Google Calendar</a></div></nav>
    <section className="hero"><h1>{trip.title ?? 'Untitled trip'}</h1><p className="muted">{date(trip.startAt,trip.startTimezone)} → {date(trip.endAt,trip.endTimezone)}</p></section>

    <section className="grid grid-3">
      <article className="card"><div className="small muted">RIGHT NOW</div><h2 style={{margin:'8px 0'}}>{rightNow.nextThing ?? 'No upcoming segment'}</h2><p className="muted">{rightNow.address ?? 'No departure location'} · {rightNow.time ? date(new Date(rightNow.time),trip.startTimezone):'—'}</p>{rightNow.bookingReference&&<div className="pill">{rightNow.bookingReference}</div>}</article>
      <article className="card"><div className="small muted">BUDGET</div><h2 style={{margin:'8px 0'}}>{budget.length ? money(budgetTotal,budget[0].currency) : 'Not set'}</h2><p className="muted">Recorded spend: {expensePage.items.length ? money(expenseTotal,expensePage.items[0].currency) : 'No expenses'}</p></article>
      <article className="card"><div className="small muted">BRIEFING</div><h2 style={{margin:'8px 0'}}>Trip-local briefing</h2><p className="muted">Generated from canonical trip data. No live monitoring.</p><Link className="btn secondary" href={`/trips/${tripId}/briefing`}>Open briefing</Link></article>
    </section>

    <section className="card" style={{marginTop:16}}><div className="row"><h2 className="section-title">Timeline</h2><span className="pill">{timeline.segments.length} segments · {timeline.connections.length} inferred connections</span></div><div className="list">{timeline.segments.map((s:any)=><div className="card" key={s.segmentId} style={{background:'#fafafa'}}><div className="row"><strong>{s.segmentType}{s.supplierName?` · ${s.supplierName}`:''}</strong><span className="pill">{s.status}</span></div><div className="small muted" style={{marginTop:6}}>{s.departureLocation ?? 'Unknown'} → {s.arrivalLocation ?? 'Unknown'}</div><div className="small muted">{date(s.departureUtc,s.departureTimezone)} → {date(s.arrivalUtc,s.arrivalTimezone)} {s.bookingReference?` · ${s.bookingReference}`:''}</div></div>)}</div></section>

    <section className="grid grid-3" style={{marginTop:16}}>
      <article className="card"><h2 className="section-title">Documents</h2>{documents.length===0?<p className="muted small">No source documents attached.</p>:<div className="list">{documents.slice(0,8).map(d=><div key={d.documentId} className="row"><span className="small">{d.sourceReference ?? d.sourceType}</span><a className="btn secondary" href={`/api/v1/trips/${tripId}/documents/${d.documentId}/content`}>Open</a></div>)}</div>}</article>
      <article className="card"><h2 className="section-title">Conflicts</h2>{conflicts.filter(c=>c.status!=='RESOLVED').length===0?<p className="muted small">No active conflicts detected.</p>:<div className="list">{conflicts.filter(c=>c.status!=='RESOLVED').slice(0,6).map((c:any)=><div key={c.conflictId} className="card" style={{background:'#fff7f7'}}><div className="row"><strong>{c.conflictType}</strong><span className="pill">{c.status}</span></div><div className="small" style={{marginTop:6}}>{c.summary}</div></div>)}</div>}</article>
      <article className="card"><h2 className="section-title">Safety</h2><p className="small muted">Consent: {safety.consent?.status ?? 'PENDING'}</p><p className="small muted">Trusted contacts: {safety.contacts.length}</p><p className="small muted">Location shares: {safety.shares.length}</p><Link className="btn secondary" href={`/trips/${tripId}/safety`}>Safety controls</Link></article>
    </section>

    <section className="grid grid-3" style={{marginTop:16}}>
      <article className="card"><h2 className="section-title">Expenses</h2>{expensePage.items.slice(0,6).map((e:any)=><div className="row" key={e.expenseId}><span className="small">{e.merchantOrDescription}</span><strong className="small">{money(e.amount,e.currency)}</strong></div>)}{expensePage.items.length===0&&<p className="muted small">No expenses yet.</p>}<Link className="btn secondary" href={`/trips/${tripId}/expenses`} style={{marginTop:10,display:'inline-flex'}}>Expense details</Link></article>
      <article className="card"><h2 className="section-title">Group</h2><p className="small muted">{group ? `${group.participants.length} participant(s)` : 'No group created'}</p><Link className="btn secondary" href={`/trips/${tripId}/group`}>Group controls</Link></article>
      <article className="card"><h2 className="section-title">Preferences</h2>{Object.keys(preferences).length===0?<p className="muted small">No preferences set.</p>:<div className="list">{Object.entries(preferences).slice(0,6).map(([k,v])=><div className="row" key={k}><span className="small">{k}</span><span className="small muted">{String(v)}</span></div>)}</div>}</article>
    </section>

    <div style={{marginTop:18}}><TripActions tripId={tripId} segments={trip.segments.map((s:any)=>({segmentId:s.segmentId,rowVersion:s.rowVersion,segmentType:s.segmentType,supplierName:s.supplierName,bookingReference:s.bookingReference,departureLocal:s.departureLocal,arrivalLocal:s.arrivalLocal,departureLocation:s.departureLocation,arrivalLocation:s.arrivalLocation,status:s.status}))} budgetRows={budget}/></div>
  </main>;
}
