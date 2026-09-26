'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteTripButton({
  tripId,
  tripTitle,
  rowVersion,
}: {
  tripId: string;
  tripTitle: string;
  rowVersion: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirmArchive() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/v1/trips/${tripId}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ row_version: rowVersion }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(body?.error?.message ?? `Archive failed (${r.status})`);
      }
      router.push('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Archive failed');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        className="btn secondary"
        onClick={() => setOpen(true)}
        style={{ color: '#b91c1c' }}
      >
        Archive trip
      </button>
    );
  }

  return (
    <div
      className="card"
      style={{ borderColor: '#fecaca', background: '#fff7f7' }}
    >
      <strong>Archive this trip?</strong>
      <p className="small muted" style={{ marginTop: 4 }}>
        &ldquo;{tripTitle}&rdquo; will be hidden from your home page. You can
        restore it later from the archive, or delete it permanently.
      </p>
      <div className="actions" style={{ marginTop: 12 }}>
        <button
          className="btn"
          onClick={confirmArchive}
          disabled={busy}
          style={{ background: '#dc2626' }}
        >
          {busy ? 'Archiving…' : 'Yes, archive'}
        </button>
        <button
          className="btn secondary"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
      {error && (
        <div className="small" style={{ marginTop: 8, color: '#b91c1c' }}>
          {error}
        </div>
      )}
    </div>
  );
}