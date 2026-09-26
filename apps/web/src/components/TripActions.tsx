'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Save, MapPin, ShieldCheck, ShieldOff } from 'lucide-react';

function key() {
  return crypto.randomUUID();
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      body.error?.message ?? `Request failed (${response.status})`,
    );
  return body.data;
}

type Segment = {
  segmentId: string;
  rowVersion: number;
  segmentType: string;
  supplierName: string | null;
  bookingReference: string | null;
  departureLocal: string | null;
  arrivalLocal: string | null;
  departureLocation: string | null;
  arrivalLocation: string | null;
  status: string;
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default function TripActions({
  tripId,
  segments,
  budgetRows,
}: {
  tripId: string;
  segments: Segment[];
  budgetRows: any[];
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [expense, setExpense] = useState({
    amount: '',
    currency: 'INR',
    category: '',
    merchant_or_description: '',
    incurred_at: new Date().toISOString().slice(0, 16),
    location: '',
  });
  const [selected, setSelected] = useState(segments[0]?.segmentId ?? '');
  const [field, setField] = useState('departure_location');
  const [value, setValue] = useState('');
  const [version, setVersion] = useState(segments[0]?.rowVersion ?? 1);
  const [pref, setPref] = useState({ key: '', value: '' });
  const [consent, setConsent] = useState<any>(null);
  const [share, setShare] = useState({ lat: '', long: '', accuracy: '50' });

  const selectedSegment = segments.find(s => s.segmentId === selected);

  function flash(fn: () => Promise<unknown>) {
    setMessage('');
    setError('');
    fn()
      .then(() =>
        setMessage(
          'Saved. Reloading the Wallet will show the canonical result.',
        ),
      )
      .catch(e =>
        setError(e instanceof Error ? e.message : 'Failed'),
      );
  }

  return (
    <section className="space-y-4">
      {/* CORRECT CANONICAL DATA */}
      <Card title="Correct trip data">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Segment</Label>
            <Select
              value={selected}
              onChange={e => {
                const s = segments.find(
                  x => x.segmentId === e.target.value,
                );
                setSelected(e.target.value);
                setVersion(s?.rowVersion ?? 1);
              }}
            >
              {segments.map(s => (
                <option key={s.segmentId} value={s.segmentId}>
                  {s.segmentType} · {s.supplierName ?? 'unknown'}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Field</Label>
            <Select
              value={field}
              onChange={e => setField(e.target.value)}
            >
              {[
                'departure_location',
                'arrival_location',
                'booking_reference',
                'departure_local',
                'arrival_local',
                'supplier_name',
              ].map(v => (
                <option key={v}>{v}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Row version</Label>
            <Input
              type="number"
              value={version}
              onChange={e => setVersion(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <Label>New value</Label>
          <Input
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={
              selectedSegment
                ? String(
                    (selectedSegment as any)[
                      field.replace(/_([a-z])/g, (_, c) =>
                        c.toUpperCase(),
                      )
                    ] ?? '',
                  )
                : ''
            }
          />
        </div>
        <div>
          <Button
            onClick={() =>
              flash(async () =>
                request(`/api/v1/trips/${tripId}/corrections`, {
                  method: 'POST',
                  headers: { 'Idempotency-Key': key() },
                  body: JSON.stringify({
                    entity_type: 'SEGMENT',
                    entity_id: selected,
                    field_name: field,
                    new_value: value,
                    row_version: version,
                    reason: 'Traveler correction',
                  }),
                }),
              )
            }
          >
            <Save className="size-4" />
            Apply correction
          </Button>
        </div>
      </Card>

      {/* ADD EXPENSE */}
      <Card title="Add expense">
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['amount', 'Amount'],
              ['currency', 'Currency'],
              ['category', 'Category'],
              ['merchant_or_description', 'Merchant / description'],
              ['incurred_at', 'Incurred at'],
              ['location', 'Location'],
            ] as const
          ).map(([k, l]) => (
            <div key={k}>
              <Label>{l}</Label>
              <Input
                value={(expense as any)[k]}
                onChange={e =>
                  setExpense(x => ({ ...x, [k]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
        <div>
          <Button
            onClick={() =>
              flash(async () =>
                request(`/api/v1/trips/${tripId}/expenses`, {
                  method: 'POST',
                  headers: { 'Idempotency-Key': key() },
                  body: JSON.stringify({
                    ...expense,
                    amount: Number(expense.amount),
                    incurred_at: new Date(
                      expense.incurred_at,
                    ).toISOString(),
                    category: expense.category || undefined,
                    location: expense.location || undefined,
                  }),
                }),
              )
            }
          >
            <Plus className="size-4" />
            Record expense
          </Button>
        </div>
      </Card>

      {/* TRIP PREFERENCE */}
      <Card title="Trip preference">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Preference key</Label>
            <Input
              value={pref.key}
              onChange={e =>
                setPref(x => ({ ...x, key: e.target.value }))
              }
              placeholder="accommodation_style"
            />
          </div>
          <div>
            <Label>Value</Label>
            <Input
              value={pref.value}
              onChange={e =>
                setPref(x => ({ ...x, value: e.target.value }))
              }
              placeholder="quiet private room"
            />
          </div>
        </div>
        <div>
          <Button
            disabled={!pref.key}
            onClick={() =>
              flash(async () =>
                request(
                  `/api/v1/trips/${tripId}/preferences/${encodeURIComponent(
                    pref.key,
                  )}`,
                  {
                    method: 'PUT',
                    headers: { 'Idempotency-Key': key() },
                    body: JSON.stringify({ value: pref.value }),
                  },
                ),
              )
            }
          >
            <Save className="size-4" />
            Save preference
          </Button>
        </div>
      </Card>

      {/* SAFETY */}
      <Card title="Safety consent & one-time location share">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              flash(async () => {
                const r = await request(
                  `/api/v1/trips/${tripId}/safety`,
                  {
                    method: 'POST',
                    body: JSON.stringify({ action: 'GRANT' }),
                  },
                );
                setConsent(r);
                return r;
              })
            }
          >
            <ShieldCheck className="size-4" />
            Grant safety consent
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              flash(async () => {
                const r = await request(
                  `/api/v1/trips/${tripId}/safety`,
                  {
                    method: 'POST',
                    body: JSON.stringify({ action: 'WITHDRAW' }),
                  },
                );
                setConsent(r);
                return r;
              })
            }
          >
            <ShieldOff className="size-4" />
            Withdraw consent
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['lat', 'Latitude'],
              ['long', 'Longitude'],
              ['accuracy', 'Accuracy (m)'],
            ] as const
          ).map(([k, l]) => (
            <div key={k}>
              <Label>{l}</Label>
              <Input
                value={(share as any)[k]}
                onChange={e =>
                  setShare(x => ({ ...x, [k]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>

        <div>
          <Button
            disabled={!share.lat || !share.long}
            onClick={() =>
              flash(async () => {
                const current = await request(
                  `/api/v1/trips/${tripId}/safety`,
                );
                const consentId =
                  current.consent?.status === 'GRANTED'
                    ? current.consent.consentId
                    : null;
                if (!consentId)
                  throw new Error('Grant safety consent first');
                return request(
                  `/api/v1/trips/${tripId}/safety/share-location`,
                  {
                    method: 'POST',
                    headers: { 'Idempotency-Key': key() },
                    body: JSON.stringify({
                      lat: Number(share.lat),
                      long: Number(share.long),
                      accuracy: Number(share.accuracy),
                      consent_reference: consentId,
                    }),
                  },
                );
              })
            }
          >
            <MapPin className="size-4" />
            Share location once
          </Button>
        </div>
      </Card>

      {/* FEEDBACK */}
      {(message || error) && (
        <div
          className={
            'rounded-lg border px-4 py-3 text-sm ' +
            (error
              ? 'border-destructive/30 bg-destructive/5 text-destructive'
              : 'border-emerald-300 bg-emerald-50 text-emerald-900')
          }
        >
          <strong>{error ? 'Action failed' : 'Action complete'}</strong>
          <div className="mt-1 text-xs opacity-80">
            {error || message}
          </div>
        </div>
      )}
    </section>
  );
}