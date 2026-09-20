import { db } from '../db';
import { recordEvent } from '../events';

function esc(value: string) { return value.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); }
function icsDate(d: Date) { return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''); }
export async function renderCalendar(tripId: string, tenantId: string, actorId?: string) {
  const trip = await db.trip.findFirst({ where: { tripId, tenantId }, include: { segments: { orderBy: { departureUtc: 'asc' } } } });
  if (!trip) throw new Error('NOT_FOUND: trip');
  const events = trip.segments.filter(s => s.departureUtc && s.arrivalUtc).map(s => [
    'BEGIN:VEVENT', `UID:${s.segmentId}@tripcopilot`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(s.departureUtc!)}`, `DTEND:${icsDate(s.arrivalUtc!)}`, `SUMMARY:${esc(`${s.segmentType}${s.supplierName ? ` — ${s.supplierName}` : ''}`)}`, `LOCATION:${esc(`${s.departureLocation ?? ''} → ${s.arrivalLocation ?? ''}`)}`, s.bookingReference ? `DESCRIPTION:${esc(`Booking reference: ${s.bookingReference}`)}` : '', 'END:VEVENT'
  ].filter(Boolean).join('\r\n'));
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Trip Copilot//EN',`X-WR-CALNAME:${esc(trip.title ?? 'Trip Copilot')}`,...events,'END:VCALENDAR',''].join('\r\n');
  if (actorId) await recordEvent(db, { tenantId, tripId, eventName: 'CALENDAR_EXPORTED', actorType: 'USER', actorId, behavioralClass: 'OTHER', payload: { segmentCount: events.length } });
  return ics;
}
