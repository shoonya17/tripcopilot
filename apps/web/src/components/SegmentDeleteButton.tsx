'use client';
import { useState } from 'react';
import { X } from 'lucide-react';

export default function SegmentDeleteButton({
  tripId,
  segmentId,
  label,
}: {
  tripId: string;
  segmentId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirmDelete() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(
        `/api/v1/trips/${tripId}/segments/${segmentId}`,
        { method: 'DELETE' },
      );
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(
          body?.error?.message ?? `Delete failed (${r.status})`,
        );
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Remove ${label}`}
        title="Remove this segment"
      >
        <X className="size-4" />
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
      <p className="text-sm text-destructive">
        Remove &ldquo;{label}&rdquo; from this trip? This cannot be undone.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="btn"
          onClick={confirmDelete}
          disabled={busy}
          style={{ background: '#dc2626' }}
        >
          {busy ? 'Removing…' : 'Remove'}
        </button>
        <button
          type="button"
          className="btn secondary"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}