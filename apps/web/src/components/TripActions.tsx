'use client';
import { useState } from 'react';

function key() { return crypto.randomUUID(); }
async function request(path:string, init:RequestInit={}) {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body.data;
}

type Segment = { segmentId:string; rowVersion:number; segmentType:string; supplierName:string|null; bookingReference:string|null; departureLocal:string|null; arrivalLocal:string|null; departureLocation:string|null; arrivalLocation:string|null; status:string };
export default function TripActions({tripId, segments, budgetRows}:{tripId:string;segments:Segment[];budgetRows:any[]}) {
  const [message,setMessage]=useState(''); const [error,setError]=useState('');
  const [expense,setExpense]=useState({amount:'',currency:'INR',category:'',merchant_or_description:'',incurred_at:new Date().toISOString().slice(0,16),location:''});
  const [selected,setSelected]=useState(segments[0]?.segmentId ?? ''); const [field,setField]=useState('departure_location'); const [value,setValue]=useState(''); const [version,setVersion]=useState(segments[0]?.rowVersion ?? 1);
  const [pref,setPref]=useState({key:'',value:''}); const [consent,setConsent]=useState<any>(null);
  const [participant,setParticipant]=useState('');
  const [share,setShare]=useState({lat:'',long:'',accuracy:'50'});

  const selectedSegment=segments.find(s=>s.segmentId===selected);
  function flash(fn:()=>Promise<unknown>) { setMessage(''); setError(''); fn().then(()=>setMessage('Saved. Reloading the Wallet will show the canonical result.')).catch(e=>setError(e instanceof Error?e.message:'Failed')); }

  return <section className="stack">
    <div className="card">
      <h2 className="section-title">Correct canonical data</h2>
      <div className="grid grid-3">
        <div className="field"><label>Segment</label><select value={selected} onChange={e=>{const s=segments.find(x=>x.segmentId===e.target.value);setSelected(e.target.value);setVersion(s?.rowVersion??1);}}>{segments.map(s=><option key={s.segmentId} value={s.segmentId}>{s.segmentType} · {s.supplierName ?? 'unknown'}</option>)}</select></div>
        <div className="field"><label>Field</label><select value={field} onChange={e=>setField(e.target.value)}>{['departure_location','arrival_location','booking_reference','departure_local','arrival_local','supplier_name'].map(v=><option key={v}>{v}</option>)}</select></div>
        <div className="field"><label>Expected row version</label><input type="number" value={version} onChange={e=>setVersion(Number(e.target.value))}/></div>
      </div>
      <div className="field"><label>New value</label><input value={value} onChange={e=>setValue(e.target.value)} placeholder={selectedSegment ? String((selectedSegment as any)[field.replace(/_([a-z])/g,(_,c)=>c.toUpperCase())] ?? '') : ''}/></div>
      <button className="btn" onClick={()=>flash(async()=>request(`/api/v1/trips/${tripId}/corrections`,{method:'POST',headers:{'Idempotency-Key':key()},body:JSON.stringify({entity_type:'SEGMENT',entity_id:selected,field_name:field,new_value:value,row_version:version,reason:'Traveler correction'})}))}>Apply correction</button>
    </div>

    <div className="card">
      <h2 className="section-title">Add expense</h2>
      <div className="grid grid-3">
        {([['amount','Amount'],['currency','Currency'],['category','Category'],['merchant_or_description','Merchant / description'],['incurred_at','Incurred at'],['location','Location']] as const).map(([k,l])=><div className="field" key={k}><label>{l}</label><input value={(expense as any)[k]} onChange={e=>setExpense(x=>({...x,[k]:e.target.value}))}/></div>)}
      </div>
      <button className="btn" onClick={()=>flash(async()=>request(`/api/v1/trips/${tripId}/expenses`,{method:'POST',headers:{'Idempotency-Key':key()},body:JSON.stringify({...expense,amount:Number(expense.amount),incurred_at:new Date(expense.incurred_at).toISOString(),category:expense.category||undefined,location:expense.location||undefined})}))}>Record expense</button>
    </div>

    <div className="card">
      <h2 className="section-title">Trip preference</h2>
      <div className="grid grid-2"><div className="field"><label>Preference key</label><input value={pref.key} onChange={e=>setPref(x=>({...x,key:e.target.value}))} placeholder="accommodation_style"/></div><div className="field"><label>Value</label><input value={pref.value} onChange={e=>setPref(x=>({...x,value:e.target.value}))} placeholder="quiet private room"/></div></div>
      <button className="btn" onClick={()=>flash(async()=>request(`/api/v1/trips/${tripId}/preferences/${encodeURIComponent(pref.key)}`,{method:'PUT',headers:{'Idempotency-Key':key()},body:JSON.stringify({value:pref.value})}))} disabled={!pref.key}>Save preference</button>
    </div>

    <div className="card">
      <h2 className="section-title">Group travel</h2>
      <div className="actions"><button className="btn" onClick={()=>flash(async()=>request(`/api/v1/trips/${tripId}/group`,{method:'POST',headers:{'Idempotency-Key':key()},body:'{}'}))}>Create / open group</button></div>
      <div className="grid grid-2" style={{marginTop:12}}><div className="field"><label>Participant traveler ID</label><input value={participant} onChange={e=>setParticipant(e.target.value)} placeholder="UUID"/></div><div style={{alignSelf:'end'}}><button className="btn secondary" disabled={!participant} onClick={()=>flash(async()=>request(`/api/v1/trips/${tripId}/group/participants`,{method:'POST',headers:{'Idempotency-Key':key()},body:JSON.stringify({traveler_id:participant})}))}>Add participant</button></div></div>
    </div>

    <div className="card">
      <h2 className="section-title">Safety consent & one-time location share</h2>
      <div className="actions"><button className="btn" onClick={()=>flash(async()=>{const r=await request(`/api/v1/trips/${tripId}/safety`,{method:'POST',body:JSON.stringify({action:'GRANT'})});setConsent(r);return r})}>Grant safety consent</button><button className="btn secondary" onClick={()=>flash(async()=>{const r=await request(`/api/v1/trips/${tripId}/safety`,{method:'POST',body:JSON.stringify({action:'WITHDRAW'})});setConsent(r);return r})}>Withdraw consent</button></div>
      <div className="grid grid-3" style={{marginTop:12}}>{([['lat','Latitude'],['long','Longitude'],['accuracy','Accuracy (m)']] as const).map(([k,l])=><div className="field" key={k}><label>{l}</label><input value={(share as any)[k]} onChange={e=>setShare(x=>({...x,[k]:e.target.value}))}/></div>)}</div>
      <button className="btn" disabled={!share.lat||!share.long} onClick={()=>flash(async()=>{const current=await request(`/api/v1/trips/${tripId}/safety`);const consentId=current.consent?.status==='GRANTED'?current.consent.consentId:null;if(!consentId)throw new Error('Grant safety consent first');return request(`/api/v1/trips/${tripId}/safety/share-location`,{method:'POST',headers:{'Idempotency-Key':key()},body:JSON.stringify({lat:Number(share.lat),long:Number(share.long),accuracy:Number(share.accuracy),consent_reference:consentId})})})}>Share location once</button>
    </div>

    {(message||error) && <div className="card" style={{borderColor:error?'#fecaca':'#bbf7d0',background:error?'#fff7f7':'#f6fffb'}}><strong>{error?'Action failed':'Action complete'}</strong><div className="small muted" style={{marginTop:4}}>{error||message}</div></div>}
  </section>;
}
