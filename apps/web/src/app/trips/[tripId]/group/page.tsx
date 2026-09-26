import Link from 'next/link';
import { getActorContext } from '@/lib/auth';
import { getGroup } from '@/lib/domain/group';
import { getTripForViewer } from '@/lib/domain/trips';
import GroupPanel from '@/components/GroupPanel';

export default async function GroupPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const a = await getActorContext();
  const { tripId } = await params;

  const { viewer } = await getTripForViewer(tripId, a.tenantId, a.travelerId);
  const group = await getGroup(tripId, a.tenantId);

  return (
    <main className="shell">
      <Link href={`/trips/${tripId}`}>← Trip Wallet</Link>
      <section className="hero">
        <p className="small muted">TRAVELERS</p>
        <h1>Group Travel</h1>
        <p className="muted">
          Participants do not inherit edit, spend, booking, or action authority.
        </p>
      </section>

      <GroupPanel
        tripId={tripId}
        hasGroup={Boolean(group)}
        isOwner={viewer.isOwner}
        currentTravelerId={a.travelerId}
        group={
          group
            ? {
                groupTripId: group.groupTripId,
                ownerTravelerId: group.ownerTravelerId,
                participants: group.participants.map((p: any) => ({
                  travelerId: p.travelerId,
                  role: p.role,
                  status: p.status,
                  traveler: p.traveler ?? null,
                })),
              }
            : null
        }
      />
    </main>
  );
}