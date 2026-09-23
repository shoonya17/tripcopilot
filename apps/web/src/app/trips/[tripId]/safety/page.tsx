import Link from 'next/link';
import { getActorContext } from '@/lib/auth';
import { getSafety } from '@/lib/domain/safety';
import SafetyPanel from '@/components/SafetyPanel';

export default async function SafetyPage({ params }: { params: Promise<{ tripId: string }> }) {
  const a = await getActorContext();
  const { tripId } = await params;
  const safety = await getSafety(tripId, a.tenantId);
  const contacts = Array.isArray(safety.contacts) ? safety.contacts : [];

  return (
    <main className="shell">
      <Link href={`/trips/${tripId}`}>← Trip Wallet</Link>
      <section className="hero">
        <p className="small muted">SAFETY</p>
        <h1>Safety Brief</h1>
        <p className="muted">Informational only. No background location tracking.</p>
      </section>
      <SafetyPanel tripId={tripId} initialConsent={safety.consent ?? null} contacts={contacts} />
    </main>
  );
}