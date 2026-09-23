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

  async function confirmDelete() {
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
        throw new Error(body?.error?.message ?? `Delete failed (${r.status})`);
      }
      router.push('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
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
        Delete trip
      </button>
    );
  }

  return (
    <div
      className="card"
      style={{ borderColor: '#fecaca', background: '#fff7f7' }}
    >
      <strong>Delete this trip?</strong>
      <p className="small muted" style={{ marginTop: 4 }}>
        &ldquo;{tripTitle}&rdquo; will be archived and hidden from your home
        page. The record is kept for audit, but you won&apos;t see it again.
      </p>
      <div className="actions" style={{ marginTop: 12 }}>
        <button
          className="btn"
          onClick={confirmDelete}
          disabled={busy}
          style={{ background: '#dc2626' }}
        >
          {busy ? 'Deleting…' : 'Yes, delete'}
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