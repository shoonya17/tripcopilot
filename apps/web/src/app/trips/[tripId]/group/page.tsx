import Link from 'next/link';
import { getActorContext } from '@/lib/auth';
import { getGroup } from '@/lib/domain/group';
import GroupPanel from '@/components/GroupPanel';

export default async function GroupPage({ params }: { params: Promise<{ tripId: string }> }) {
  const a = await getActorContext();
  const { tripId } = await params;
  const group = await getGroup(tripId, a.tenantId);
  const participants = Array.isArray(group?.participants) ? group!.participants : [];

  return (
    <main className="shell">
      <Link href={`/trips/${tripId}`}>← Trip Wallet</Link>
      <section className="hero">
        <p className="small muted">TRAVELERS</p>
        <h1>Group Travel</h1>
        <p className="muted">Participants do not inherit edit, spend, booking, or action authority.</p>
      </section>

      <GroupPanel tripId={tripId} hasGroup={!!group} />

      {group && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="section-title">Participants</h2>
          {participants.length === 0
            ? <p className="muted">No participants yet. Add the first one above.</p>
            : <div className="list">{participants.map((p: any) => (
                <div className="row" key={p.travelerId}>
                  <span>{p.travelerId}</span>
                  <span className="pill">{p.role}</span>
                </div>
              ))}</div>}
        </div>
      )}
    </main>
  );
}s