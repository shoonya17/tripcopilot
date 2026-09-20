import crypto from 'node:crypto';

export function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function bookingFingerprint(input: {
  supplier?: string | null;
  bookingReference?: string | null;
  traveler?: string | null;
  departure?: string | null;
  arrival?: string | null;
  departureLocation?: string | null;
  arrivalLocation?: string | null;
}): string {
  const material = [input.supplier,input.bookingReference,input.traveler,input.departure,input.arrival,input.departureLocation,input.arrivalLocation].map(normalizeToken).join('|');
  return crypto.createHash('sha256').update(material).digest('hex');
}

export function expenseFingerprint(input: { tripId: string; travelerId?: string | null; merchant: string; amount: string; currency: string; incurredAt: string }): string {
  const material = [input.tripId,input.travelerId ?? '',normalizeToken(input.merchant),input.amount,input.currency,input.incurredAt].join('|');
  return crypto.createHash('sha256').update(material).digest('hex');
}
