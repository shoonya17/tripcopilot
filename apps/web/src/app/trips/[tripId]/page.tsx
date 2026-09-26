import Link from 'next/link';
import { getTrip, getRightNow, getTimeline } from '@/lib/domain/trips';
import { getBudget } from '@/lib/domain/budget';
import { listExpenses } from '@/lib/domain/expenses';
import { listDocuments } from '@/lib/domain/documents';
import { listConflicts } from '@/lib/domain/conflicts';
import { getSafety } from '@/lib/domain/safety';
import { getGroup } from '@/lib/domain/group';
import { getEffectivePreferences } from '@/lib/domain/preferences';
import { getDisruptionSummary } from '@/lib/domain/disruption';
import { getActorContext } from '@/lib/auth';
import TripActions from '@/components/TripActions';
import DeleteTripButton from '@/components/DeleteTripButton';
import SegmentDeleteButton from '@/components/SegmentDeleteButton';
import SegmentStatusControl from '@/components/SegmentStatusControl';
import { recordEvent } from '@/lib/events';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';

function money(amount: unknown, currency: string) {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

function date(value: Date | null | undefined, timezone?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone || undefined,
  }).format(value);
}

function isoDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const a = await getActorContext();
  const { tripId } = await params;
  const trip = await getTrip(tripId, a.tenantId);
  if (trip.ownerTravelerId !== a.travelerId) throw new Error('FORBIDDEN');

  await recordEvent(db, {
    tenantId: a.tenantId,
    tripId,
    eventName: 'WALLET_REOPENED',
    actorType: 'USER',
    actorId: a.actorId,
    behavioralClass: 'RETRIEVAL',
    payload: { source: 'wallet' },
  });

  const [
    rightNow,
    timeline,
    budget,
    expensePage,
    documents,
    conflicts,
    safety,
    group,
    preferences,
    disruptionSummary,
  ] = await Promise.all([
    getRightNow(tripId, a.tenantId),
    getTimeline(tripId, a.tenantId, a.actorId),
    getBudget(tripId, a.tenantId),
    listExpenses(tripId, a.tenantId, { page: 1, pageSize: 20 }),
    listDocuments(tripId, a.tenantId),
    listConflicts(tripId, a.tenantId),
    getSafety(tripId, a.tenantId),
    getGroup(tripId, a.tenantId),
    getEffectivePreferences(tripId, a.tenantId, a.travelerId),
    getDisruptionSummary(tripId, a.tenantId),
  ]);

  const budgetTotal = budget.reduce(
    (s: number, b: any) => s + Number(b.plannedAmount),
    0,
  );
  const confirmedExpenses = expensePage.items.filter(
    (e: any) => !(e.sourceType === 'EXTRACTED_FARE' && e.userConfirmed !== true),
  );
  const expenseTotal = confirmedExpenses.reduce(
    (s: number, e: any) => s + Number(e.amount),
    0,
  );

  const firstSegment = trip.segments.find((s: any) => s.departureUtc);
  const lastSegment = [...trip.segments]
    .reverse()
    .find((s: any) => s.arrivalUtc);

  const googleStart = firstSegment?.departureUtc
    ? new Date(firstSegment.departureUtc)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.000Z$/, 'Z')
    : '';
  const googleEnd = lastSegment?.arrivalUtc
    ? new Date(lastSegment.arrivalUtc)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.000Z$/, 'Z')
    : googleStart;
  const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    trip.title ?? 'Trip Copilot trip',
  )}&details=${encodeURIComponent('Trip Copilot calendar export')}${
    googleStart ? `&dates=${googleStart}/${googleEnd}` : ''
  }`;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Wallets
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {trip.status}
            </span>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/v1/trips/${tripId}/calendar.ics`}>ICS</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={googleLink} target="_blank" rel="noreferrer">
                Google Calendar
              </a>
            </Button>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">
          {trip.title ?? 'Untitled trip'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {date(trip.startAt, trip.startTimezone)} →{' '}
          {date(trip.endAt, trip.endTimezone)}
        </p>
      </section>

      {disruptionSummary.hasDisruption && (
        <section className="mx-auto max-w-6xl px-6 pb-6">
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
            <h2 className="text-base font-semibold text-destructive">
              ⚠ Disruption on this trip
            </h2>
            <div className="mt-4 space-y-6">
              {disruptionSummary.disruptions.map(d => (
                <div key={d.segment.segmentId}>
                  <p className="text-sm font-medium">
                    {d.segment.segmentType}
                    {d.segment.supplierName
                      ? ` · ${d.segment.supplierName}`
                      : ''}
                    {' — '}
                    <span className="text-destructive">{d.status}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.segment.departureLocation ?? '—'} →{' '}
                    {d.segment.arrivalLocation ?? '—'}
                    {d.segment.departureUtc
                      ? ` · ${isoDate(d.segment.departureUtc)}`
                      : ''}
                  </p>

                  {d.affectedSegments.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Downstream segments affected: {d.affectedSegments.length}
                      </p>
                      <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                        {d.affectedSegments.map(s => (
                          <li key={s.segmentId}>
                            <span className="font-medium">
                              {s.segmentType}
                              {s.supplierName ? ` · ${s.supplierName}` : ''}
                            </span>{' '}
                            — {s.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {d.affectedExpenses.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Expenses linked to this booking: {d.affectedExpenses.length}
                      </p>
                      <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                        {d.affectedExpenses.map(e => (
                          <li key={e.expenseId}>
                            <span className="font-medium">
                              {e.currency} {Number(e.amount).toFixed(2)}
                            </span>{' '}
                            · {e.merchantOrDescription} — {e.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {d.affectedConflicts.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Current conflicts triggered: {d.affectedConflicts.length}
                      </p>
                      <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                        {d.affectedConflicts.map(c => (
                          <li key={c.conflictId}>
                            <span className="font-medium">{c.conflictType}</span>
                            {c.summary ? ` · ${c.summary}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {d.affectedSegments.length === 0 &&
                    d.affectedExpenses.length === 0 &&
                    d.affectedConflicts.length === 0 && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No downstream segments, expenses, or conflicts are
                        linked to this booking.
                      </p>
                    )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-6xl gap-4 px-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Right Now
          </div>
          <h2 className="mt-2 text-lg font-semibold">
            {rightNow.nextThing ?? 'No upcoming segment'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {rightNow.address ?? 'No departure location'} ·{' '}
            {rightNow.time
              ? date(new Date(rightNow.time), trip.startTimezone)
              : '—'}
          </p>
          {rightNow.bookingReference && (
            <span className="mt-3 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
              {rightNow.bookingReference}
            </span>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Budget
          </div>
          <h2 className="mt-2 text-lg font-semibold">
            {budget.length
              ? money(budgetTotal, budget[0].currency)
              : 'Not set'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Recorded spend:{' '}
            {confirmedExpenses.length
              ? money(expenseTotal, confirmedExpenses[0].currency)
              : 'No confirmed expenses'}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Briefing
          </div>
          <h2 className="mt-2 text-lg font-semibold">
            Trip-local briefing
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generated from canonical trip data. No live monitoring.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href={`/trips/${tripId}/briefing`}>
              Open briefing
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-6xl px-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Timeline</h2>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {timeline.segments.length} segments ·{' '}
              {timeline.connections.length} inferred connections
            </span>
          </div>
          <div className="space-y-3">
            {timeline.segments.map((s: any) => (
              <div
                key={s.segmentId}
                className="rounded-lg border border-border bg-muted/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-sm font-semibold">
                    {s.segmentType}
                    {s.supplierName ? ` · ${s.supplierName}` : ''}
                  </strong>
                  <div className="flex shrink-0 items-center gap-2">
                    <SegmentStatusControl
                      tripId={tripId}
                      segmentId={s.segmentId}
                      currentStatus={String(s.status)}
                      rowVersion={s.rowVersion}
                    />
                    <SegmentDeleteButton
                      tripId={tripId}
                      segmentId={s.segmentId}
                      label={`${s.segmentType ?? 'Segment'}${
                        s.supplierName ? ` — ${s.supplierName}` : ''
                      }`}
                    />
                  </div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {s.departureLocation ?? 'Unknown'} →{' '}
                  {s.arrivalLocation ?? 'Unknown'}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {date(s.departureUtc, s.departureTimezone)} →{' '}
                  {date(s.arrivalUtc, s.arrivalTimezone)}
                  {s.bookingReference ? ` · ${s.bookingReference}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 grid max-w-6xl gap-4 px-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Documents</h2>
          {documents.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No source documents attached.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {documents.slice(0, 8).map((d: any) => (
                <div
                  key={d.documentId}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate text-sm">
                    {d.sourceReference ?? d.sourceType}
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`/api/v1/trips/${tripId}/documents/${d.documentId}/content`}
                    >
                      Open
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Conflicts</h2>
          {conflicts.filter((c: any) => c.status !== 'RESOLVED').length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No active conflicts detected.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {conflicts
                .filter((c: any) => c.status !== 'RESOLVED')
                .slice(0, 6)
                .map((c: any) => (
                  <div
                    key={c.conflictId}
                    className="rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-sm">{c.conflictType}</strong>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {c.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {c.summary}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Safety</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Consent: {safety.consent?.status ?? 'PENDING'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Trusted contacts: {safety.contacts.length}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Location shares: {safety.shares.length}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href={`/trips/${tripId}/safety`}>Safety controls</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto mt-6 grid max-w-6xl gap-4 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Expenses</h2>
          {expensePage.items.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No expenses yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {expensePage.items.slice(0, 6).map((e: any) => (
                <div
                  key={e.expenseId}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate text-sm">
                    {e.merchantOrDescription}
                  </span>
                  <strong className="text-sm">
                    {money(e.amount, e.currency)}
                  </strong>
                </div>
              ))}
            </div>
          )}
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href={`/trips/${tripId}/expenses`}>Expense details</Link>
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Group</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {group
              ? `${group.participants.length} participant(s)`
              : 'No group created'}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href={`/trips/${tripId}/group`}>Group controls</Link>
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Preferences</h2>
          {Object.keys(preferences).length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No preferences set.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {Object.entries(preferences)
                .slice(0, 6)
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate text-sm">{k}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {String(v)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-16">
        <TripActions
          tripId={tripId}
          segments={trip.segments.map((s: any) => ({
            segmentId: s.segmentId,
            rowVersion: s.rowVersion,
            segmentType: s.segmentType,
            supplierName: s.supplierName,
            bookingReference: s.bookingReference,
            departureLocal: s.departureLocal,
            arrivalLocal: s.arrivalLocal,
            departureLocation: s.departureLocation,
            arrivalLocation: s.arrivalLocation,
            status: s.status,
          }))}
          budgetRows={budget}
        />
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-16">
        <DeleteTripButton
          tripId={trip.tripId}
          tripTitle={trip.title ?? 'Untitled trip'}
          rowVersion={trip.rowVersion}
        />
      </div>
    </div>
  );
}