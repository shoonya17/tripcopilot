'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/state';

export default function ProcessingPage() {
  const params = useParams<{ ingestionId: string }>();
  const router = useRouter();
  const [state, setState] = useState('RECEIVED');
  const [tripId, setTripId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let redirected = false;

    async function tick() {
      if (redirected) return;
      try {
        const r = await fetch('/api/v1/ingestion/' + params.ingestionId);
        if (!r.ok) return;
        const j = await r.json();
        const s = j?.data?.productState ?? 'RECEIVED';
        const t = j?.data?.tripId ?? null;

        if (stop) return;
        setState(s);
        if (t) setTripId(t);

        if (s === 'CONFIRMED') {
          redirected = true;
          if (t) {
            router.replace('/trips/' + t);
          } else {
            router.replace('/trips');
          }
        }
      } catch {
        // Ignore transient network errors; next tick will retry.
      }
    }

    tick();
    const id = setInterval(tick, 1500);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [params.ingestionId, router]);

  async function confirm() {
    setError(null);
    setConfirming(true);
    try {
      const r = await fetch(
        `/api/v1/ingestion/${params.ingestionId}/confirm`,
        { method: 'POST' },
      );
      const text = await r.text();
      const j = text ? JSON.parse(text) : {};
      if (!r.ok) {
        throw new Error(j?.error?.message ?? `Server returned ${r.status}`);
      }
      const t = j?.data?.tripId ?? null;
      if (t) {
        router.replace('/trips/' + t);
      } else {
        router.replace('/trips');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm failed');
    } finally {
      setConfirming(false);
    }
  }

  const showConfirm = state === 'REVIEW_REQUIRED';
  const showFailed = state === 'PARSE_FAILED';
  const showSpinner =
    !showConfirm && !showFailed && state !== 'CONFIRMED';

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">
          Understanding your trip
        </h1>
        <p className="mt-2 text-muted-foreground">
          Current state:{' '}
          <strong className="text-foreground">{state}</strong>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Source evidence is preserved. Canonical truth is committed only
          after validation and deduplication.
        </p>

        {showConfirm && (
          <div className="mt-8 rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Review required</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The AI extracted your trip, but some fields are below the
              confidence threshold or missing. You can confirm and continue
              now, then edit on the Wallet.
            </p>
            <div className="mt-4">
              <Button onClick={confirm} disabled={confirming}>
                {confirming ? 'Committing…' : 'Confirm and continue'}
              </Button>
            </div>
            {error && (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        )}

        {showSpinner && <LoadingState label={`Processing — ${state}`} />}

        {showFailed && (
          <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <h2 className="text-base font-semibold text-destructive">
              We couldn&apos;t parse this document
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Try the manual entry option or contact support.
            </p>
            {tripId && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => router.replace('/trips/' + tripId)}
                >
                  Open trip anyway
                </Button>
              </div>
            )}
          </div>
        )}

        {state === 'CONFIRMED' && (
          <div className="mt-8 rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Trip confirmed</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Redirecting to your Wallet…
            </p>
            <div className="mt-4">
              <Button
                onClick={() =>
                  router.replace(tripId ? '/trips/' + tripId : '/trips')
                }
              >
                Open Wallet
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}