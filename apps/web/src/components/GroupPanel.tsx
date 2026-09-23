'use client';
import { useState } from 'react';

function key() { return crypto.randomUUID(); }
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body.data;
}

export default function GroupPanel({ tripId, hasGroup }: { tripId: string; hasGroup: boolean }) {
  const [participant, setParticipant] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function flash(fn: () => Promise<unknown>) {
    setMessage(''); setError(''); setBusy(true);
    fn()
      .then(() => { setMessage('Saved. Reload to see updated group.'); window.location.reload(); })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setBusy(false));
  }

  return (
    <section className="stack">
      <div className="card">
        <h2 className="section-title">{hasGroup ? 'Group' : 'Create a group'}</h2>
        {!hasGroup && <p className="muted">No group yet. Create one to add travelers to this trip.</p>}
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn" disabled={busy || hasGroup} onClick={() => flash(async () =>
            request(`/api/v1/trips/${tripId}/group`, { method: 'POST', headers: { 'Idempotency-Key': key() }, body: '{}' })
          )}>Create group</button>
        </div>
      </div>

      {hasGroup && (
        <div className="card">
          <h2 className="section-title">Add participant</h2>
          <div className="field">
            <label>Participant traveler ID</label>
            <input value={participant} onChange={e => setParticipant(e.target.value)} placeholder="UUID" />
          </div>
          <button className="btn" style={{ marginTop: 12 }} disabled={busy || !participant} onClick={() => flash(async () =>
            request(`/api/v1/trips/${tripId}/group/participants`, {
              method: 'POST',
              headers: { 'Idempotency-Key': key() },
              body: JSON.stringify({ traveler_id: participant }),
            })
          )}>Add participant</button>
        </div>
      )}

      {(message || error) && (
        <div className="card" style={{ borderColor: error ? '#fecaca' : '#bbf7d0', background: error ? '#fff7f7' : '#f6fffb' }}>
          <strong>{error ? 'Action failed' : 'Action complete'}</strong>
          <div className="small muted" style={{ marginTop: 4 }}>{error || message}</div>
        </div>
      )}
    </section>
  );
}