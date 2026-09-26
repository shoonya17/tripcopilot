import Link from 'next/link';
import { getActorContext } from '@/lib/auth';
import { getSafety } from '@/lib/domain/safety';
import { getTrip } from '@/lib/domain/trips';
import { listTrustedContacts } from '@/lib/domain/trustedContacts';
import SafetyPanel from '@/components/SafetyPanel';
import SafetyBrief from '@/components/SafetyBrief';
import EmergencyInfo from '@/components/EmergencyInfo';
import OfflineItinerary from '@/components/OfflineItinerary';
import ShareLocationButton from '@/components/ShareLocationButton';
import TrustedContactsPanel from '@/components/TrustedContactsPanel';

export default async function SafetyPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const a = await getActorContext();
  const { tripId } = await params;

  const [safety, trip, contacts] = await Promise.all([
    getSafety(tripId, a.tenantId),
    getTrip(tripId, a.tenantId),
    listTrustedContacts(a.travelerId, a.tenantId),
  ]);

  const segments = (trip.segments ?? []).map((s: any) => ({
    segmentId: s.segmentId,
    segmentType: s.segmentType,
    supplierName: s.supplierName ?? null,
    bookingReference: s.bookingReference ?? null,
    departureLocal: s.departureLocal ?? null,
    arrivalLocal: s.arrivalLocal ?? null,
    departureLocation: s.departureLocation ?? null,
    arrivalLocation: s.arrivalLocation ?? null,
    departureUtc: s.departureUtc ?? null,
    departureTimezone: s.departureTimezone ?? null,
    status: String(s.status ?? 'UNKNOWN'),
  }));

  const timezones = [
    trip.startTimezone,
    trip.endTimezone,
    ...segments.map((s: any) => s.departureTimezone),
  ].filter(Boolean);

  const consentGranted = safety.consent?.status === 'GRANTED';

  const contactRows = contacts.map(c => ({
    trustedContactId: c.trustedContactId,
    name: c.name,
    contactType: c.contactType,
    contactValue: c.contactValue,
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

      <EmergencyInfo timezones={timezones} />

      <div className="card">
        <h2 className="section-title">One-tap location share</h2>
        <p className="small muted">
          Uses your device&apos;s location. Sends the current position once,
          then stops. No background tracking.
        </p>
        <ShareLocationButton
          tripId={tripId}
          consentGranted={consentGranted}
        />
      </div>

      <SafetyBrief segments={segments} />

      <OfflineItinerary
        tripTitle={trip.title ?? 'Untitled trip'}
        segments={segments}
      />

      <TrustedContactsPanel initialContacts={contactRows} />

      <SafetyPanel
        tripId={tripId}
        initialConsent={safety.consent ?? null}
      />
    </main>
  );
}