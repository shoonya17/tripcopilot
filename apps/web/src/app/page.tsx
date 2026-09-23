import Link from 'next/link';
import { actor } from '@/lib/route';
import { listTrips } from '@/lib/domain/trips';
import { env } from '@/lib/env';
import { Button } from '@/components/ui/button';
import { MapPin, Plus, ArrowRight, Inbox } from 'lucide-react';

type AnySegment = {
  segmentId?: string;
  segmentType?: string;
  supplierName?: string | null;
  departureUtc?: Date | string | null;
  arrivalUtc?: Date | string | null;
  departureLocal?: Date | string | null;
  departureLocation?: string | null;
  arrivalLocation?: string | null;
};

type AnyTrip = Awaited<ReturnType<typeof listTrips>>[number];

function formatDeparture(segment: AnySegment): string {
  if (segment.departureLocal) {
    const d = new Date(segment.departureLocal);
    return d.toLocaleString(undefined, {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (segment.departureUtc) {
    const d = new Date(segment.departureUtc);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return '';
}

function formatRelative(target: Date): string {
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 0) {
    const abs = Math.abs(diffMin);
    if (abs < 60) return `started ${abs} min ago`;
    const h = Math.round(abs / 60);
    if (h < 24) return `started ${h}h ago`;
    return `started ${Math.round(h / 24)}d ago`;
  }

  if (diffMin < 60) return `in ${diffMin} min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `in ${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `in ${d}d`;
  return `in ${Math.round(d / 30)} mo`;
}

function nextSegmentAcrossTrips(trips: AnyTrip[]) {
  const now = new Date();
  type Candidate = {
    trip: AnyTrip;
    segment: AnySegment;
    kind: 'IN_TRANSIT' | 'UPCOMING';
  };

  const inTransit: Candidate[] = [];
  const upcoming: Candidate[] = [];

  for (const trip of trips) {
    const segments = (trip.segments ?? []) as unknown as AnySegment[];
    for (const segment of segments) {
      if (!segment.departureUtc) continue;
      const dep = new Date(segment.departureUtc);
      const arr = segment.arrivalUtc ? new Date(segment.arrivalUtc) : null;

      if (dep <= now && arr && arr > now) {
        inTransit.push({ trip, segment, kind: 'IN_TRANSIT' });
      } else if (dep > now) {
        upcoming.push({ trip, segment, kind: 'UPCOMING' });
      }
    }
  }

  if (inTransit.length > 0) {
    inTransit.sort(
      (a, b) =>
        new Date(a.segment.arrivalUtc!).getTime() -
        new Date(b.segment.arrivalUtc!).getTime(),
    );
    return inTransit[0];
  }

  if (upcoming.length > 0) {
    upcoming.sort(
      (a, b) =>
        new Date(a.segment.departureUtc!).getTime() -
        new Date(b.segment.departureUtc!).getTime(),
    );
    return upcoming[0];
  }

  return null;
}

function groupTrips(trips: AnyTrip[]) {
  const now = new Date();
  const inProgress: AnyTrip[] = [];
  const upcoming: AnyTrip[] = [];
  const past: AnyTrip[] = [];

  for (const trip of trips) {
    const status = String(trip.status);

    if (status === 'ACTIVE') {
      inProgress.push(trip);
    } else if (
      status === 'COMPLETED' ||
      status === 'CANCELLED' ||
      status === 'ARCHIVED'
    ) {
      past.push(trip);
    } else if (status === 'PLANNED') {
      const end = trip.endAt ? new Date(trip.endAt) : null;
      const start = trip.startAt ? new Date(trip.startAt) : null;

      const hasFutureSegment = (trip.segments ?? []).some(
        (s: AnySegment) =>
          s.arrivalUtc && new Date(s.arrivalUtc) > now,
      );

      const started = start ? start <= now : false;
      const finished = end ? end < now : false;

      if (finished) {
        past.push(trip);
      } else if (started && (hasFutureSegment || (end && end > now))) {
        inProgress.push(trip);
      } else if (started) {
        past.push(trip);
      } else {
        upcoming.push(trip);
      }
    } else {
      upcoming.push(trip);
    }
  }

  return { inProgress, upcoming, past };
}

function TripCard({ trip }: { trip: AnyTrip }) {
  return (
    <Link
      href={`/trips/${trip.tripId}`}
      className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-3">
        <strong className="text-base font-semibold">
          {trip.title ?? 'Untitled trip'}
        </strong>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
          {trip.status}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {trip.segments.length} segments | {trip.expenses.length} expenses |{' '}
        {trip.conflicts.length} open conflicts
      </p>
      <div className="mt-4 flex items-center text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        Open wallet <ArrowRight className="ml-1 size-4" />
      </div>
    </Link>
  );
}

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

  const next = nextSegmentAcrossTrips(trips);
  const groups = groupTrips(trips);

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

      {next && (
        <section className="mx-auto max-w-6xl px-6 pb-10">
          <Link
            href={`/trips/${next.trip.tripId}`}
            className="block rounded-xl border border-primary/40 bg-primary/5 p-6 transition-colors hover:bg-primary/10"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
              <span className="text-primary">
                {next.kind === 'IN_TRANSIT' ? 'In transit' : 'Next up'}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {next.kind === 'IN_TRANSIT'
                  ? next.segment.arrivalUtc
                    ? `arrives ${formatRelative(new Date(next.segment.arrivalUtc))}`
                    : 'in progress'
                  : formatRelative(new Date(next.segment.departureUtc!))}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <strong className="text-lg font-semibold">
                {next.segment.segmentType ?? 'Segment'}
              </strong>
              {next.segment.supplierName && (
                <span className="text-sm text-muted-foreground">
                  · {next.segment.supplierName}
                </span>
              )}
            </div>
            {(next.segment.departureLocation ||
              next.segment.arrivalLocation) && (
              <p className="mt-1 text-sm text-muted-foreground">
                {next.segment.departureLocation ?? '—'}
                {' → '}
                {next.segment.arrivalLocation ?? '—'}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {next.trip.title ?? 'Untitled trip'}
            </p>
            <p className="mt-3 text-sm font-medium">
              {formatDeparture(next.segment)}
            </p>
          </Link>
        </section>
      )}

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
          <div className="space-y-10">
            {groups.inProgress.length > 0 && (
              <div>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  In progress
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.inProgress.map((t) => (
                    <TripCard key={t.tripId} trip={t} />
                  ))}
                </div>
              </div>
            )}

            {groups.upcoming.length > 0 && (
              <div>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Upcoming
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.upcoming.map((t) => (
                    <TripCard key={t.tripId} trip={t} />
                  ))}
                </div>
              </div>
            )}

            {groups.past.length > 0 && (
              <details>
                <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
                  Past · {groups.past.length}
                </summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.past.map((t) => (
                    <TripCard key={t.tripId} trip={t} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </section>
    </div>
  );
}