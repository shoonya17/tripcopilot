'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Segment = { segment_type: string; supplier_name: string; booking_reference: string; departure_local: string; departure_timezone: string; arrival_local: string; arrival_timezone: string; departure_location: string; arrival_location: string; status: string };
const blank = (): Segment => ({ segment_type: 'FLIGHT', supplier_name: '', booking_reference: '', departure_local: '', departure_timezone: 'Asia/Kolkata', arrival_local: '', arrival_timezone: 'Asia/Kolkata', departure_location: '', arrival_location: '', status: 'CONFIRMED' });

export default function NewTripPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [segments, setSegments] = useState<Segment[]>([blank()]);
  const [fallbackText, setFallbackText] = useState('');
  const [mode, setMode] = useState<'structured'|'text'|'pdf'>('structured');
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function update(i:number, key:keyof Segment, value:string) { setSegments(x => x.map((s,idx)=>idx===i?{...s,[key]:value}:s)); }
  async function submit() {
    setBusy(true); setError('');
    if (mode === 'pdf') {
      if (!pdf) { setError('Choose a PDF booking or itinerary.'); setBusy(false); return; }
      const form = new FormData(); form.set('file', pdf);
      try { const r = await fetch('/api/v1/ingestion/pdf', { method:'POST', headers:{'Idempotency-Key':crypto.randomUUID()}, body:form }); const j=await r.json(); if(!r.ok) throw new Error(j.error?.message ?? 'PDF ingestion failed'); router.push(`/trips/processing/${j.data.ingestionId}`); } catch(e) { setError(e instanceof Error?e.message:'PDF ingestion failed'); } finally { setBusy(false); }
      return;
    }
    const payload = mode === 'structured'
      ? { title: title || 'My Trip', structured_trip: { title: title || 'My Trip', start_at: segments[0]?.departure_local || null, end_at: segments.at(-1)?.arrival_local || null, start_timezone: segments[0]?.departure_timezone || null, end_timezone: segments.at(-1)?.arrival_timezone || null, segments: segments.map(s=>({ ...s, supplier_name:s.supplier_name||null, booking_reference:s.booking_reference||null, departure_local:s.departure_local||null, departure_timezone:s.departure_timezone||null, arrival_local:s.arrival_local||null, arrival_timezone:s.arrival_timezone||null, departure_location:s.departure_location||null, arrival_location:s.arrival_location||null })) } }
      : { source_text: fallbackText };
    fetch('/api/v1/ingestion/manual',{method:'POST',headers:{'content-type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(payload)})
      .then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error?.message??'Failed');router.push(`/trips/processing/${j.data.ingestionId}`)})
      .catch(e=>setError(e instanceof Error?e.message:'Failed')).finally(()=>setBusy(false));
  }

  return <main className="shell">
    <nav className="nav"><a href="/">← Trip Wallet</a><span className="pill">Manual fallback</span></nav>
    <section className="card stack">
      <div><h1 style={{marginBottom:6}}>Add your trip</h1><p className="muted">Enter structured details directly, or paste source evidence. Manual data follows the same validation, provenance and canonical commit path.</p></div>
      <div className="actions"><button className={`btn ${mode==='structured'?'':'secondary'}`} onClick={()=>setMode('structured')}>Structured entry</button><button className={`btn ${mode==='text'?'':'secondary'}`} onClick={()=>setMode('text')}>Paste evidence</button><button className={`btn ${mode==='pdf'?'':'secondary'}`} onClick={()=>setMode('pdf')}>Upload PDF</button></div>
      {mode==='structured' ? <>
        <div className="field"><label>Trip title</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Delhi → Bangkok → Singapore" /></div>
        {segments.map((s,i)=><div key={i} className="card" style={{background:'#fafafa'}}><div className="row"><strong>Segment {i+1}</strong>{segments.length>1&&<button className="btn secondary" onClick={()=>setSegments(x=>x.filter((_,idx)=>idx!==i))}>Remove</button>}</div><div className="grid grid-2" style={{marginTop:12}}>
          {([['segment_type','Type'],['supplier_name','Supplier'],['booking_reference','Booking reference'],['departure_local','Departure (local ISO)'],['departure_timezone','Departure timezone'],['arrival_local','Arrival (local ISO)'],['arrival_timezone','Arrival timezone'],['departure_location','Departure location'],['arrival_location','Arrival location']] as const).map(([k,label])=><div className="field" key={k}><label>{label}</label><input value={s[k]} onChange={e=>update(i,k,e.target.value)} placeholder={k.includes('local')?'2026-10-04T09:00:00':''}/></div>)}
          <div className="field"><label>Status</label><select value={s.status} onChange={e=>update(i,'status',e.target.value)}>{['BOOKED','CONFIRMED','CHANGED','CANCELLED','COMPLETED','UNKNOWN'].map(v=><option key={v}>{v}</option>)}</select></div>
        </div></div>)}
        <button className="btn secondary" onClick={()=>setSegments(x=>[...x,blank()])}>+ Add segment</button>
      </> : mode==='pdf' ? <div className="field"><label>Booking / itinerary PDF</label><input type="file" accept="application/pdf,.pdf" onChange={e=>setPdf(e.target.files?.[0] ?? null)}/><p className="small muted">PDF bytes are preserved as source evidence, security-checked, parsed and validated before canonical commit.</p></div> : <div className="field"><label>Booking / itinerary evidence</label><textarea rows={18} value={fallbackText} onChange={e=>setFallbackText(e.target.value)} placeholder="Paste flight, hotel or itinerary details…" /></div>}
      <button className="btn" disabled={busy || (mode==='text'?!fallbackText.trim():mode==='pdf'?!pdf:segments.length===0)} onClick={submit}>{busy?'Processing…':'Create trip'}</button>
      {error && <div style={{color:'#b91c1c'}}>{error}</div>}
    </section>
  </main>;
}
