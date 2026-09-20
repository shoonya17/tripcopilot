import { db } from '../db';
import { env } from '../env';
import { recordEvent } from '../events';
import { generateBriefingContent, type BriefingContent } from '../ai';

function localDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date).reduce((a,p)=>(a[p.type]=p.value,a), {} as Record<string,string>);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export type BriefingKind = 'morning'|'evening'|'pretrip_t24';

export async function generateBriefing(tripId: string, tenantId: string, travelDate = new Date(), kind: BriefingKind = 'morning') {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId }, include: { owner: true, segments: { orderBy: { departureUtc: 'asc' } } } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  if (kind !== 'pretrip_t24' && trip.status !== 'ACTIVE') throw new Error('CONFLICT: post-trip briefing is not available for this trip state');
  if (kind === 'pretrip_t24' && trip.status !== 'PLANNED') throw new Error('CONFLICT: pre-trip briefing requires a planned trip');
  const tz = trip.owner.defaultTimezone ?? trip.startTimezone ?? 'UTC';
  const dateKey = localDateInTimeZone(travelDate, tz);
  const generationKey = `${tripId}:${dateKey}:${kind}`;
  const existing = await db.briefingGeneration.findUnique({ where: { generationKey } });
  if (existing) return existing;

  const next = trip.segments.find(s => s.departureUtc && s.departureUtc.getTime() >= travelDate.getTime());
  const canonical = {
    title: trip.title, travelDate: dateKey, slot: kind,
    nextSegment: next ? { supplier: next.supplierName, from: next.departureLocation, to: next.arrivalLocation, departure: next.departureUtc?.toISOString(), reference: next.bookingReference } : null,
    segments: trip.segments.map(s => ({ type:s.segmentType, supplier:s.supplierName, from:s.departureLocation, to:s.arrivalLocation, departure:s.departureUtc?.toISOString(), arrival:s.arrivalUtc?.toISOString() })),
  };

  let content: BriefingContent;
  let model = 'deterministic-fallback';
  if (env.OPENAI_API_KEY) {
    const generated = await generateBriefingContent(canonical);
    content = generated.content;
    model = generated.model;
  } else {
    content = {
      TODAY: `Your trip wallet is ready for ${dateKey}.`,
      TOMORROW: 'Check the Wallet for the next confirmed segment.',
      READY_FOR_NEXT_STOP: next ? `${next.departureLocation ?? 'Departure'} → ${next.arrivalLocation ?? 'next stop'}${next.bookingReference ? ` · ${next.bookingReference}` : ''}` : 'No upcoming segment found in canonical trip data.',
      ONE_THING_YOU_DIDNT_KNOW: 'This briefing uses canonical trip data; it does not monitor live disruptions.',
      SAFETY_BRIEF: 'Keep original booking evidence accessible and verify supplier instructions directly when needed.',
    };
  }

  return db.$transaction(async tx => {
    const generated = await tx.briefingGeneration.create({ data: { tenantId, tripId, travelDate: new Date(`${dateKey}T00:00:00Z`), content, generatedAt: new Date(), generationKey, model, policyVersion: env.OPENAI_EXTRACTION_POLICY_VERSION } });
    await tx.trip.update({ where: { tripId }, data: { lastBriefingGeneratedAt: new Date(), rowVersion: { increment: 1 } } });
    await recordEvent(tx, { tenantId, tripId, eventName: 'DAILY_BRIEFING_GENERATED', actorType: 'SYSTEM', payload: { briefingGenerationId: generated.briefingGenerationId, slot: kind, travelDate: dateKey } });
    return generated;
  });
}

export async function viewBriefing(tripId:string, tenantId:string, actorId:string, kind:BriefingKind='morning') {
  const briefing = await generateBriefing(tripId, tenantId, new Date(), kind);
  await recordEvent(db, { tenantId, tripId, eventName:'DAILY_BRIEFING_VIEWED', actorType:'USER', actorId, behavioralClass:'BRIEFING', payload:{briefingGenerationId:briefing.briefingGenerationId,slot:kind} });
  return briefing;
}
