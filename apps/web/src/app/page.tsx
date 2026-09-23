import Link from 'next/link';
import { actor } from '@/lib/route';
import { listTrips } from '@/lib/domain/trips';
import { env } from '@/lib/env';
import { Button } from '@/components/ui/button';
import { MapPin, Plus, ArrowRight, Inbox } from 'lucide-react';

export default async function HomePage() {
  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );

  const shouldUseClerk = !env.DEV_AUTH_BYPASS && clerkConfigured;

  if (shouldUseClerk) {
    const { auth } = await import('@clerk/nextjs/server');
    const { isAuthenticated, redirectToSignIn } = await auth();
    if (!isAuthenticated) {
      return redirectToSignIn();
    }
  }

  const currentActor = await actor();
  const trips = await listTrips(
    currentActor.tenantId,
    currentActor.travelerId,
  );

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <MapPin className="size-5 text-primary" />
            <span className="text-lg font-semibold">Trip Copilot</span>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            End-to-end v1
          </span>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            One wallet for the whole journey.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Bring travel information together. Trip Copilot turns evidence
            into a structured trip, then gives you a fast Wallet, Right Now
            and Daily Briefing.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/trips/new">
              <Plus className="size-4" />
              Add a trip
            </Link>
          </Button>

          {trips[0] && (
            <Button asChild variant="outline">
              <Link href={`/trips/${trips[0].tripId}`}>
                Open latest trip
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        {trips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border">
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted p-3">
                <Inbox className="size-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold">No trips yet</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Create your first trip from a booking, email, PDF, text or
                manual entry.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href="/trips/new">Add a trip</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Your trips
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((t) => (
                <Link
                  key={t.tripId}
                  href={`/trips/${t.tripId}`}
                  className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-base font-semibold">
                      {t.title ?? 'Untitled trip'}
                    </strong>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                      {t.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-muted-foreground">
                    {t.segments.length} segments | {t.expenses.length}{' '}
                    expenses | {t.conflicts.length} open conflicts
                  </p>

                  <div className="mt-4 flex items-center text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Open wallet <ArrowRight className="ml-1 size-4" />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}