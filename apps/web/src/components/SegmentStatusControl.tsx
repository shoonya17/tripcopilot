'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUSES = ['BOOKED', 'CONFIRMED', 'CHANGED', 'CANCELLED', 'COMPLETED', 'UNKNOWN'];

export default function SegmentStatusControl({
  tripId,
  segmentId,
  currentStatus,
  rowVersion,
}: {
  tripId: string;
  segmentId: string;
  currentStatus: string;
  rowVersion: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function update(next: string) {
    if (next === value) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/v1/trips/${tripId}/corrections`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          entity_type: 'SEGMENT',
          entity_id: segmentId,
          field_name: 'status',
          new_value: next,
          row_version: rowVersion,
          reason: 'Traveler marked segment status',
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(body?.error?.message ?? `Failed (${r.status})`);
      }
      setValue(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setValue(currentStatus);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-1">
      <select
        value={value}
        disabled={busy}
        onChange={e => update(e.target.value)}
        className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {STATUSES.map(s => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}