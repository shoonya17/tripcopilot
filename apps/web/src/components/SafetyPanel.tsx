'use client';
import { useState } from 'react';

function key() { return crypto.randomUUID(); }
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body.data;
}

type Consent = { status: string; consentId?: string } | null;

export default function SafetyPanel({ tripId, initialConsent, contacts }: { tripId: string; initialConsent: Consent; contacts: any[] }) {
  const [consent, setConsent] = useState<Consent>(initialConsent);
  const [share, setShare] = useState({ lat: '', long: '', accuracy: '50' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function flash(fn: () => Promise<unknown>) {
    setMessage(''); setError(''); setBusy(true);
    fn()
      .then(() => { setMessage('Saved. Reload to see updated state.'); return request(`/api/v1/trips/${tripId}/safety`); })
      .then((r: any) => { if (r?.consent) setConsent(r.consent); })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setBusy(false));
  }

  const granted = consent?.status === 'GRANTED';

  return (
    <section className="stack">
      <div className="card">
        <h2 className="section-title">Consent</h2>
        <p className="muted">
          {granted
            ? 'Safety features are enabled. You can share your location once below.'
            : 'Safety features are off. Grant consent to enable one-time location share and trusted contacts.'}
        </p>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn" disabled={busy || granted} onClick={() => flash(async () => {
            const r = await request(`/api/v1/trips/${tripId}/safety`, { method: 'POST', body: JSON.stringify({ action: 'GRANT' }) });
            setConsent(r.consent ?? r); return r;
          })}>Grant consent</button>
          <button className="btn secondary" disabled={busy || !granted} onClick={() => flash(async () => {
            const r = await request(`/api/v1/trips/${tripId}/safety`, { method: 'POST', body: JSON.stringify({ action: 'WITHDRAW' }) });
            setConsent(r.consent ?? r); return r;
          })}>Withdraw consent</button>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">One-time location share</h2>
        <p className="muted small">Sends your current position once, then stops. No background tracking.</p>
        <div className="grid grid-3" style={{ marginTop: 12 }}>
          {([['lat', 'Latitude'], ['long', 'Longitude'], ['accuracy', 'Accuracy (m)']] as const).map(([k, l]) => (
            <div className="field" key={k}>
              <label>{l}</label>
              <input value={(share as any)[k]} onChange={e => setShare(x => ({ ...x, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
        <button className="btn" style={{ marginTop: 12 }} disabled={busy || !share.lat || !share.long || !granted} onClick={() => flash(async () => {
          const current = await request(`/api/v1/trips/${tripId}/safety`);
          const consentId = current.consent?.status === 'GRANTED' ? current.consent.consentId : null;
          if (!consentId) throw new Error('Grant safety consent first');
          return request(`/api/v1/trips/${tripId}/safety/share-location`, {
            method: 'POST',
            headers: { 'Idempotency-Key': key() },
            body: JSON.stringify({
              lat: Number(share.lat), long: Number(share.long), accuracy: Number(share.accuracy),
              consent_reference: consentId,
            }),
          });
        })}>Share location once</button>
        {!granted && <p className="small muted" style={{ marginTop: 8 }}>Grant consent above to enable this.</p>}
      </div>

      <div className="card">
        <h2 className="section-title">Trusted contacts</h2>
        {contacts.length === 0
          ? <p className="muted">No trusted contacts yet. Add them from the Trip Wallet.</p>
          : <div className="list">{contacts.map((c: any) => (
              <div className="row" key={c.contactId ?? c.id}>
                <span>{c.name ?? c.email ?? c.contactId}</span>
                <span className="pill">{c.relationship ?? c.role ?? ''}</span>
              </div>
            ))}</div>}
      </div>

      {(message || error) && (
        <div className="card" style={{ borderColor: error ? '#fecaca' : '#bbf7d0', background: error ? '#fff7f7' : '#f6fffb' }}>
          <strong>{error ? 'Action failed' : 'Action complete'}</strong>
          <div className="small muted" style={{ marginTop: 4 }}>{error || message}</div>
        </div>
      )}
    </section>
  );
}