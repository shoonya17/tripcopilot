'use client';
import { useState } from 'react';

function key() {
  return crypto.randomUUID();
}
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  }
  return body.data;
}

type Participant = {
  travelerId: string;
  role: string;
  status: string;
  traveler?: { displayName: string | null; email: string | null } | null;
};

type Group = {
  groupTripId: string;
  ownerTravelerId: string;
  participants: Participant[];
};

function displayName(
  p: Participant,
  currentTravelerId: string,
): string {
  if (p.travelerId === currentTravelerId) return 'You';
  return (
    p.traveler?.displayName ??
    p.traveler?.email ??
    p.travelerId.slice(0, 8) + '…'
  );
}

export default function GroupPanel({
  tripId,
  hasGroup,
  isOwner,
  currentTravelerId,
  group,
}: {
  tripId: string;
  hasGroup: boolean;
  isOwner: boolean;
  currentTravelerId: string;
  group: Group | null;
}) {
  const [participant, setParticipant] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function flash(fn: () => Promise<unknown>) {
    setMessage('');
    setError('');
    setBusy(true);
    fn()
      .then(() => {
        setMessage('Saved. Reloading…');
        setTimeout(() => window.location.reload(), 500);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setBusy(false));
  }

  const activeParticipants = (group?.participants ?? []).filter(
    p => p.status === 'ACTIVE',
  );

  return (
    <section className="stack">
      {!hasGroup && isOwner && (
        <div className="card">
          <h2 className="section-title">Create a group</h2>
          <p className="muted">
            No group yet. Create one to add travelers to this trip. They will
            see the wallet read-only.
          </p>
          <div className="actions" style={{ marginTop: 12 }}>
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                flash(async () =>
                  request(`/api/v1/trips/${tripId}/group`, {
                    method: 'POST',
                    headers: { 'Idempotency-Key': key() },
                    body: '{}',
                  }),
                )
              }
            >
              Create group
            </button>
          </div>
        </div>
      )}

      {!hasGroup && !isOwner && (
        <div className="card">
          <p className="muted">
            No group has been created for this trip yet. The trip owner can add
            you once they create one.
          </p>
        </div>
      )}

      {hasGroup && group && (
        <div className="card">
          <h2 className="section-title">Participants</h2>
          <p className="small muted">
            {activeParticipants.length} traveler
            {activeParticipants.length === 1 ? '' : 's'} on this trip
          </p>
          <div className="list" style={{ marginTop: 12 }}>
            {activeParticipants.map(p => (
              <div className="row" key={p.travelerId}>
                <div>
                  <strong>{displayName(p, currentTravelerId)}</strong>
                  {p.travelerId === currentTravelerId && (
                    <span className="small muted" style={{ marginLeft: 6 }}>
                      ({p.role.toLowerCase()})
                    </span>
                  )}
                </div>
                <span className="pill">{p.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasGroup && isOwner && (
        <div className="card">
          <h2 className="section-title">Add participant</h2>
          <p className="small muted">
            Paste the traveler ID of someone already registered. Email
            invitations will be added later.
          </p>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Participant traveler ID</label>
            <input
              value={participant}
              onChange={e => setParticipant(e.target.value)}
              placeholder="UUID"
            />
          </div>
          <button
            className="btn"
            style={{ marginTop: 12 }}
            disabled={busy || !participant}
            onClick={() =>
              flash(async () =>
                request(`/api/v1/trips/${tripId}/group/participants`, {
                  method: 'POST',
                  headers: { 'Idempotency-Key': key() },
                  body: JSON.stringify({ traveler_id: participant }),
                }),
              )
            }
          >
            Add participant
          </button>
        </div>
      )}

      {(message || error) && (
        <div
          className="card"
          style={{
            borderColor: error ? '#fecaca' : '#bbf7d0',
            background: error ? '#fff7f7' : '#f6fffb',
          }}
        >
          <strong>{error ? 'Action failed' : 'Action complete'}</strong>
          <div className="small muted" style={{ marginTop: 4 }}>
            {error || message}
          </div>
        </div>
      )}
    </section>
  );
}