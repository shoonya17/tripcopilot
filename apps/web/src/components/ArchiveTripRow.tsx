'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export function ArchiveTripRow({
  tripId,
  title,
  status,
  segmentCount,
  lastUpdated,
}: {
  tripId: string;
  title: string;
  status: string;
  segmentCount: number;
  lastUpdated: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');

  async function restore() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/v1/trips/${tripId}/restore`, {
        method: 'POST',
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(body?.error?.message ?? `Restore failed (${r.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed');
      setBusy(false);
    }
  }

  async function hardDelete() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/v1/trips/${tripId}/hard`, {
        method: 'DELETE',
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(body?.error?.message ?? `Delete failed (${r.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="text-base font-semibold">{title}</strong>
          <p className="mt-1 text-sm text-muted-foreground">
            {segmentCount} segment{segmentCount === 1 ? '' : 's'} ·{' '}
            archived {formatDate(lastUpdated)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
          {status}
        </span>
      </div>

      {!confirming && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn"
            onClick={restore}
            disabled={busy}
          >
            {busy ? 'Working…' : 'Restore'}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => setConfirming(true)}
            disabled={busy}
            style={{ color: '#b91c1c' }}
          >
            Delete permanently
          </button>
        </div>
      )}

      {confirming && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">
            Delete &ldquo;{title}&rdquo; permanently? This removes the trip,
            its segments, expenses, documents, conflicts, and audit trail.
            This cannot be undone.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Type the trip title to confirm:
          </p>
          <input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={title}
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn"
              onClick={hardDelete}
              disabled={busy || typed !== title}
              style={{ background: '#dc2626' }}
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setConfirming(false);
                setTyped('');
                setError('');
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
    </div>
  );
}