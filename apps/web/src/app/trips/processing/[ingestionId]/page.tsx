'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/state';

function friendlyStatus(state: string): string {
  switch (state) {
    case 'RECEIVED':
      return 'Reading your document…';
    case 'PARSING':
      return 'Extracting your travel details…';
    case 'EXTRACTED':
      return 'Building your trip…';
    case 'REVIEW_REQUIRED':
      return 'One thing needs your review';
    case 'CONFIRMED':
      return 'Redirecting to your Wallet…';
    case 'PARSE_FAILED':
      return "We couldn't read this file";
    default:
      return 'Working on it…';
  }
}

export default function ProcessingPage() {
  const params = useParams<{ ingestionId: string }>();
  const router = useRouter();
  const [state, setState] = useState('RECEIVED');
  const [tripId, setTripId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

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

  // After 20s, if still working, show a reassuring hint.
  useEffect(() => {
    if (state === 'CONFIRMED' || state === 'PARSE_FAILED') return;
    if (state === 'REVIEW_REQUIRED') return;
    const t = setTimeout(() => setSlow(true), 20000);
    return () => clearTimeout(t);
  }, [state]);

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
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="text-2xl font-bold tracking-tight">
          {friendlyStatus(state)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This usually takes a few seconds.
        </p>

        {showConfirm && (
          <div className="mt-8 rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">
              Review your trip
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We found most of your trip details, but a few things were
              unclear. You can continue now and edit on the Wallet.
            </p>
            <div className="mt-4">
              <Button onClick={confirm} disabled={confirming}>
                {confirming ? 'Continuing…' : 'Continue to Wallet'}
              </Button>
            </div>
            {error && (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        )}

        {showSpinner && (
          <div className="mt-8">
            <LoadingState label="" />
            {slow && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Still working — large documents can take a bit longer.
              </p>
            )}
          </div>
        )}

        {showFailed && (
          <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <h2 className="text-base font-semibold text-destructive">
              We couldn&apos;t read this file
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Try the manual entry option, or contact support if this keeps
              happening.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => router.push('/trips/new')}
              >
                Try another file
              </Button>
              {tripId && (
                <Button
                  variant="outline"
                  onClick={() => router.replace('/trips/' + tripId)}
                >
                  Open trip anyway
                </Button>
              )}
            </div>
          </div>
        )}

        {state === 'CONFIRMED' && (
          <div className="mt-8 rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Trip ready</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Opening your Wallet…
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