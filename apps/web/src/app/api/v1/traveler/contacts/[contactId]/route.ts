import { NextRequest } from 'next/server';
import { actor, safe } from '@/lib/route';
import { ok } from '@/lib/http';
import { removeTrustedContact } from '@/lib/domain/trustedContacts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> },
) {
  return safe(async () => {
    const a = await actor();
    const { contactId } = await params;
    return ok(
      await removeTrustedContact(
        a.travelerId,
        a.tenantId,
        a.actorId,
        contactId,
      ),
    );
  });
}