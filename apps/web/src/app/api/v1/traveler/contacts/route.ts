import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { created, ok } from '@/lib/http';
import {
  listTrustedContacts,
  addTrustedContact,
} from '@/lib/domain/trustedContacts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return safe(async () => {
    const a = await actor();
    const rows = await listTrustedContacts(a.travelerId, a.tenantId);
    return ok(rows);
  });
}

export async function POST(request: NextRequest) {
  return safe(async () => {
    const a = await actor();
    const body = await request.json().catch(() => ({}));
    const row = await addTrustedContact(
      a.travelerId,
      a.tenantId,
      a.actorId,
      {
        name: String(body?.name ?? ''),
        contactType: String(body?.contact_type ?? ''),
        contactValue: String(body?.contact_value ?? ''),
      },
    );
    return created(row);
  });
}