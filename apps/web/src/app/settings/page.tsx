import Link from 'next/link';
import { getActorContext } from '@/lib/auth';
import { getOrCreateIngestToken } from '@/lib/domain/traveler';
import { ArrowLeft, Mail } from 'lucide-react';

const INBOUND_DOMAIN =
  process.env.INBOUND_EMAIL_DOMAIN ?? 'inbound.postmarkapp.com';

export default async function SettingsPage() {
  const a = await getActorContext();
  const token = await getOrCreateIngestToken(a.travelerId, a.tenantId);
  const address = `${token}@${INBOUND_DOMAIN}`;

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
            Settings
          </span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Forward bookings by email
            </h2>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            Forward any booking confirmation email to this address. Trip
            Copilot reads the PDF and image attachments and adds them to your
            wallet. Nothing else about the email is stored.
          </p>

          <div className="mt-5">
            <code className="block w-full truncate rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm font-mono">
              {address}
            </code>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Each attachment becomes a segment on an existing trip, or a new
            trip if it doesn't match one you already have.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">How it works</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Forward your booking confirmation email to the address above.</li>
            <li>PDFs and screenshots attached to the email are read by AI.</li>
            <li>Extracted trips appear on your home page within a minute.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}