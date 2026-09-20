function partsForZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value])) as Record<string, string>;
}

/** Convert a timezone-less local ISO datetime plus IANA zone to an absolute instant. */
export function zonedDateTimeToUtc(local: string | null | undefined, timeZone: string | null | undefined): Date | null {
  if (!local) return null;
  const parsed = new Date(local);
  if (Number.isNaN(parsed.getTime())) return null;
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(local)) return parsed;
  if (!timeZone) return parsed;

  // Iteratively solve UTC = local wall-clock time - zone offset.
  const [datePart, timePart = '00:00:00'] = local.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, secondRaw] = timePart.replace(/Z$/, '').split(':');
  const second = Number.parseFloat(secondRaw ?? '0');
  let candidate = Date.UTC(year, month - 1, day, Number(hour), Number(minute), Math.trunc(second), Math.round((second % 1) * 1000));
  for (let i = 0; i < 4; i++) {
    const observed = partsForZone(new Date(candidate), timeZone);
    const observedUtc = Date.UTC(Number(observed.year), Number(observed.month) - 1, Number(observed.day), Number(observed.hour), Number(observed.minute), Number(observed.second));
    const targetUtc = Date.UTC(year, month - 1, day, Number(hour), Number(minute), Math.trunc(second));
    const offset = observedUtc - targetUtc;
    candidate -= offset;
  }
  return new Date(candidate);
}

export function sortSegments<T extends { departureUtc: Date | null; arrivalUtc: Date | null }>(segments: T[]): T[] {
  return [...segments].sort((a,b) => (a.departureUtc?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.departureUtc?.getTime() ?? Number.MAX_SAFE_INTEGER));
}

export function deriveRightNow(segments: Array<{
  segmentId: string;
  supplierName: string | null;
  bookingReference: string | null;
  departureUtc: Date | null;
  departureLocation: string | null;
  arrivalLocation: string | null;
  departureTimezone: string | null;
  status: string;
}>, now = new Date()) {
  const upcoming = segments.filter(s => s.departureUtc && s.departureUtc.getTime() >= now.getTime()).sort((a,b) => a.departureUtc!.getTime() - b.departureUtc!.getTime())[0];
  if (!upcoming) return { hasUpcoming: false, segmentId: null, nextThing: null, address: null, time: null, bookingReference: null };
  return {
    hasUpcoming: true,
    segmentId: upcoming.segmentId,
    nextThing: upcoming.supplierName ? `${upcoming.supplierName} — ${upcoming.arrivalLocation ?? 'next stop'}` : 'Next travel segment',
    address: upcoming.departureLocation,
    time: upcoming.departureUtc?.toISOString() ?? null,
    bookingReference: upcoming.bookingReference
  };
}
