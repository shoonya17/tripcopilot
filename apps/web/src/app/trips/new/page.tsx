'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  PenLine,
  Upload,
  X,
} from 'lucide-react';

type SegmentDraft = {
  segment_type: string;
  supplier_name: string;
  booking_reference: string;
  departure_local: string;
  departure_timezone: string;
  arrival_local: string;
  arrival_timezone: string;
  departure_location: string;
  arrival_location: string;
  status: string;
};

function blank(): SegmentDraft {
  return {
    segment_type: 'FLIGHT',
    supplier_name: '',
    booking_reference: '',
    departure_local: '',
    departure_timezone: '',
    arrival_local: '',
    arrival_timezone: '',
    departure_location: '',
    arrival_location: '',
    status: 'UNKNOWN',
  };
}

type Mode = 'structured' | 'text' | 'pdf';

export default function NewTripPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('structured');
  const [title, setTitle] = useState('');
  const [segments, setSegments] = useState<SegmentDraft[]>([blank()]);
  const [fallbackText, setFallbackText] = useState('');
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, k: keyof SegmentDraft, v: string) => {
    setSegments(x => x.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));
  };

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    setPdfs(prev => {
      const seen = new Set(prev.map(f => `${f.name}:${f.size}`));
      const merged = [...prev];
      for (const f of incoming) {
        const key = `${f.name}:${f.size}`;
        if (!seen.has(key)) {
          merged.push(f);
          seen.add(key);
        }
      }
      return merged;
    });
  }

  function removeFile(idx: number) {
    setPdfs(prev => prev.filter((_, i) => i !== idx));
  }

  async function uploadOne(file: File): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/v1/ingestion/pdf', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: fd,
    });
    const text = await r.text();
    const j = text ? JSON.parse(text) : {};
    if (!r.ok) {
      throw new Error(
        j?.error?.message ?? `Upload failed (${r.status})`,
      );
    }
    return j.data.ingestionId;
  }

  async function submit() {
    setError(null);
    setBusy(true);
    setProgress(null);
    try {
      if (mode === 'pdf') {
        if (pdfs.length === 0) return;

        let lastId: string | null = null;

        for (let i = 0; i < pdfs.length; i++) {
          setProgress(
            `Uploading ${i + 1} of ${pdfs.length}…`,
          );
          lastId = await uploadOne(pdfs[i]);
        }

        if (lastId) {
          router.push(`/trips/processing/${lastId}`);
        }
        return;
      }

      const payload =
        mode === 'structured'
          ? {
              title: title || 'My Trip',
              structured_trip: {
                title: title || 'My Trip',
                start_at: segments[0]?.departure_local || null,
                end_at: segments.at(-1)?.arrival_local || null,
                start_timezone:
                  segments[0]?.departure_timezone || null,
                end_timezone:
                  segments.at(-1)?.arrival_timezone || null,
                segments: segments.map(s => ({
                  ...s,
                  supplier_name: s.supplier_name || null,
                  booking_reference: s.booking_reference || null,
                  departure_local: s.departure_local || null,
                  departure_timezone: s.departure_timezone || null,
                  arrival_local: s.arrival_local || null,
                  arrival_timezone: s.arrival_timezone || null,
                  departure_location: s.departure_location || null,
                  arrival_location: s.arrival_location || null,
                })),
              },
            }
          : { source_text: fallbackText };

      const r = await fetch('/api/v1/ingestion/manual', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      const j = text ? JSON.parse(text) : {};
      if (!r.ok)
        throw new Error(j?.error?.message ?? 'Failed');
      router.push(`/trips/processing/${j.data.ingestionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const canSubmit =
    !busy &&
    (mode === 'text'
      ? Boolean(fallbackText.trim())
      : mode === 'pdf'
      ? pdfs.length > 0
      : segments.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Trip Wallet
          </Link>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Manual fallback
          </span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Add your trip
          </h1>
          <p className="mt-2 text-muted-foreground">
            Enter structured details directly, or paste source evidence.
            Manual data follows the same validation, provenance and canonical
            commit path.
          </p>
        </div>

        <div className="mb-6 inline-flex rounded-lg border border-border bg-card p-1">
          {[
            { id: 'structured' as const, label: 'Structured entry', icon: PenLine },
            { id: 'text' as const, label: 'Paste evidence', icon: FileText },
            { id: 'pdf' as const, label: 'Upload PDF', icon: Upload },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
                (mode === id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground')
              }
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-6 rounded-xl border border-border bg-card p-6">
          {mode === 'structured' && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Trip title
                </label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Delhi → Bangkok → Singapore"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {segments.map((s, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-muted/30 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <strong className="text-sm font-semibold">
                      Segment {i + 1}
                    </strong>
                    {segments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSegments(x =>
                            x.filter((_, idx) => idx !== i),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ['segment_type', 'Type'],
                        ['supplier_name', 'Supplier'],
                        ['booking_reference', 'Booking reference'],
                        ['departure_local', 'Departure (local ISO)'],
                        ['departure_timezone', 'Departure timezone'],
                        ['arrival_local', 'Arrival (local ISO)'],
                        ['arrival_timezone', 'Arrival timezone'],
                        ['departure_location', 'Departure location'],
                        ['arrival_location', 'Arrival location'],
                      ] as const
                    ).map(([k, label]) => (
                      <div key={k}>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          {label}
                        </label>
                        <input
                          value={s[k]}
                          onChange={e =>
                            update(i, k, e.target.value)
                          }
                          placeholder={
                            k.includes('local')
                              ? '2026-10-04T09:00:00'
                              : ''
                          }
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Status
                      </label>
                      <select
                        value={s.status}
                        onChange={e =>
                          update(i, 'status', e.target.value)
                        }
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {[
                          'BOOKED',
                          'CONFIRMED',
                          'CHANGED',
                          'CANCELLED',
                          'COMPLETED',
                          'UNKNOWN',
                        ].map(v => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSegments(x => [...x, blank()])
                }
              >
                <Plus className="size-4" />
                Add segment
              </Button>
            </>
          )}

          {mode === 'pdf' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Booking / itinerary PDF
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
                  <Upload className="size-4" />
                  Choose file{pdfs.length > 0 ? 's' : ''}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    className="hidden"
                    onChange={e => {
                      addFiles(e.target.files);
                      // Reset so the same file can be picked again
                      // if removed and re-added.
                      e.target.value = '';
                    }}
                  />
                </label>

                {pdfs.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {pdfs.length} file{pdfs.length === 1 ? '' : 's'} selected
                  </span>
                )}
              </div>

              {pdfs.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {pdfs.map((f, i) => (
                    <li
                      key={`${f.name}:${f.size}:${i}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-3 text-xs text-muted-foreground">
                PDF bytes are preserved as source evidence, security-checked,
                parsed and validated before canonical commit. You can select
                multiple files at once, or add them one at a time.
              </p>
            </div>
          )}

          {mode === 'text' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Booking / itinerary evidence
              </label>
              <textarea
                rows={14}
                value={fallbackText}
                onChange={e => setFallbackText(e.target.value)}
                placeholder="Paste flight, hotel or itinerary details…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          {progress && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              {progress}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={submit} disabled={!canSubmit}>
              {busy ? progress ?? 'Processing…' : 'Create trip'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}