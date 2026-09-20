import { db } from './db';

export const BEHAVIORAL_CLASS: Record<string, string | null> = {
  RIGHT_NOW_VIEWED: 'RETRIEVAL',
  WALLET_REOPENED: 'RETRIEVAL',
  FIELD_CORRECTED: 'CORRECTION',
  EXPENSE_CORRECTED: 'CORRECTION',
  TIMELINE_REVIEWED: 'REVIEW',
  DOCUMENT_ACCESSED: 'REVIEW',
  CONFLICT_REVIEWED: 'REVIEW',
  DAILY_BRIEFING_VIEWED: 'BRIEFING',
  BRIEFING_DISMISSED: 'BRIEFING',
  GROUP_COORDINATED: 'OTHER',
  SAFETY_INTERACTED: 'OTHER',
  REFERRAL_CLICKED: 'OTHER',
  EXPENSE_CREATED: 'OTHER',
  BOOKING_RECEIVED: null,
};

export async function recordEvent(tx: any, input: {
  tenantId: string;
  tripId?: string;
  eventName: string;
  actorType: 'USER' | 'SYSTEM' | 'SUPPORT';
  actorId?: string;
  payload?: unknown;
  behavioralClass?: string | null;
}) {
  const inferred = input.behavioralClass !== undefined ? input.behavioralClass : BEHAVIORAL_CLASS[input.eventName] ?? null;
  const event = await tx.eventLog.create({ data: {
    tenantId: input.tenantId,
    tripId: input.tripId,
    eventName: input.eventName,
    behavioralClass: inferred,
    actorType: input.actorType,
    actorId: input.actorId,
    payload: input.payload ?? {},
    occurredAt: new Date(),
  }});
  if (tx.outboxEvent) {
    await tx.outboxEvent.create({ data: { eventId: event.eventId, tenantId: input.tenantId, eventName: input.eventName, payload: input.payload ?? {}, availableAt: new Date() } });
  }
  return event;
}
