import Link from 'next/link';
import { getActorContext } from '@/lib/auth';
import { viewBriefing } from '@/lib/domain/briefing';
import { ArrowLeft } from 'lucide-react';

const SECTIONS: Array<{ key: string; title: string }> = [
  { key: 'TODAY', title: 'Today' },
  { key: 'TOMORROW', title: 'Tomorrow' },
  { key: 'READY_FOR_NEXT_STOP', title: 'Ready for next stop' },
  {
    key: 'ONE_THING_YOU_DIDNT_KNOW',
    title: "One thing you didn't know",
  },
  { key: 'SAFETY_BRIEF', title: 'Safety brief' },
];

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const a = await getActorContext();
  const { tripId } = await params;
  const b = await viewBriefing(
    tripId,
    a.tenantId,
    a.actorId,
    'morning',
  );
  const content = b.content as Record<string, string | undefined>;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href={`/trips/${tripId}`}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Trip Wallet
          </Link>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Daily briefing
          </span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Daily briefing
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {new Date(b.travelDate).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Generated from your trip wallet. No live monitoring.
          </p>
        </div>

        <div className="space-y-4">
          {SECTIONS.map(({ key, title }) => {
            const text =
              content?.[key] ?? 'No briefing content available.';
            return (
              <article
                key={key}
                className="rounded-xl border border-border bg-card p-6"
              >
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {title}
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed">
                  {text}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-10 rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Briefings are scheduled and informational. They do not
          monitor suppliers or detect disruptions.
        </div>
      </main>
    </div>
  );
}