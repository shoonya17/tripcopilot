import { PrismaClient, TripStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenantId = process.env.DEV_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';
  const travelerId = process.env.DEV_TRAVELER_ID ?? '00000000-0000-0000-0000-000000000002';
  const traveler = await prisma.traveler.upsert({
    where: { travelerId },
    update: {},
    create: { travelerId, tenantId, displayName: 'Demo Traveler', email: 'demo@example.com', defaultTimezone: 'Asia/Kolkata' }
  });
  await prisma.trip.upsert({
    where: { tripId: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      tripId: '00000000-0000-0000-0000-000000000010',
      tenantId,
      ownerTravelerId: traveler.travelerId,
      title: 'Demo Delhi → Bangkok → Singapore',
      status: TripStatus.PLANNED,
      startAt: new Date('2026-10-04T04:30:00Z'),
      endAt: new Date('2026-10-12T10:30:00Z'),
      startTimezone: 'Asia/Kolkata',
      endTimezone: 'Asia/Singapore'
    }
  });
}
main().finally(() => prisma.$disconnect());
