import Link from 'next/link';
import { getActorContext } from '@/lib/auth';
import { listArchivedTrips } from '@/lib/domain/trips';
import { ArchiveTripRow } from '@/components/ArchiveTripRow';
import { ArrowLeft } from 'lucide-react';

export default async function ArchivePage() {
  const a = await getActorContext();
  const trips = await listArchivedTrips(a.tenantId, a.travelerId);

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Wallets
          </Link>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Archived
          </span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Archived trips</h1>
        <p className="mt-2 text-muted-foreground">
          Trips you've hidden. Restore one to bring it back to your home page,
          or delete it permanently.
        </p>

        {trips.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No archived trips.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              ← Back to Wallets
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {trips.map(t => (
              <ArchiveTripRow
                key={t.tripId}
                tripId={t.tripId}
                title={t.title ?? 'Untitled trip'}
                status={String(t.status)}
                segmentCount={t.segments.length}
                lastUpdated={new Date(t.updatedAt).toISOString()}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}