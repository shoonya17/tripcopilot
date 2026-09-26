import Link from 'next/link';
import { getActorContext } from '@/lib/auth';
import { getSafety } from '@/lib/domain/safety';
import { getTrip } from '@/lib/domain/trips';
import SafetyPanel from '@/components/SafetyPanel';
import SafetyBrief from '@/components/SafetyBrief';

export default async function SafetyPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const a = await getActorContext();
  const { tripId } = await params;
  const safety = await getSafety(tripId, a.tenantId);
  const trip = await getTrip(tripId, a.tenantId);
  const contacts = Array.isArray(safety.contacts) ? safety.contacts : [];

  const segments = (trip.segments ?? []).map((s: any) => ({
    segmentId: s.segmentId,
    segmentType: s.segmentType,
    supplierName: s.supplierName ?? null,
    departureLocation: s.departureLocation ?? null,
    arrivalLocation: s.arrivalLocation ?? null,
    departureUtc: s.departureUtc ?? null,
    status: String(s.status ?? 'UNKNOWN'),
  }));

  return (
    <main className="shell">
      <Link href={`/trips/${tripId}`}>← Trip Wallet</Link>
      <section className="hero">
        <p className="small muted">SAFETY</p>
        <h1>Safety Brief</h1>
        <p className="muted">
          Informational only. No background location tracking.
        </p>
      </section>

      <SafetyBrief segments={segments} />

      <SafetyPanel
        tripId={tripId}
        initialConsent={safety.consent ?? null}
        contacts={contacts}
      />
    </main>
  );
}