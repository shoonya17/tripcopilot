import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok, created } from '@/lib/http';
import { getSafety, setSafetyConsent, addTrustedContact, removeTrustedContact } from '@/lib/domain/safety';

export async function GET(_: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return safe(async () => { const a = await actor(); const { tripId } = await params; return ok(await getSafety(tripId, a.tenantId)); });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  return safe(async () => {
    const a = await actor(); const { tripId } = await params; const body = await request.json();
    if (body.action === 'GRANT' || body.action === 'WITHDRAW') return created(await setSafetyConsent({ tripId, tenantId: a.tenantId, travelerId: a.travelerId, actorId: a.actorId, granted: body.action === 'GRANT' }));
    if (body.action === 'ADD_CONTACT') {
      if (typeof body.name !== 'string' || !body.name.trim()) throw new Error('VALIDATION: contact name required');
      if (typeof body.contact_value !== 'string' || !body.contact_value.trim()) throw new Error('VALIDATION: contact value required');
      if (typeof body.contact_type !== 'string' || !body.contact_type.trim()) throw new Error('VALIDATION: contact type required');
      return created(await addTrustedContact({ tripId, tenantId: a.tenantId, travelerId: a.travelerId, actorId: a.actorId, name: body.name.trim(), contactValue: body.contact_value.trim(), contactType: body.contact_type.trim() }));
    }
    if (body.action === 'REMOVE_CONTACT') {
      if (typeof body.trusted_contact_id !== 'string' || !Number.isInteger(body.row_version)) throw new Error('VALIDATION: trusted_contact_id and row_version required');
      return ok(await removeTrustedContact({ tripId, tenantId: a.tenantId, travelerId: a.travelerId, actorId: a.actorId, trustedContactId: body.trusted_contact_id, rowVersion: body.row_version }));
    }
    throw new Error('VALIDATION: unsupported safety action');
  });
}
