import { z } from 'zod';

export const tripStatusSchema = z.enum(['PLANNED','ACTIVE','COMPLETED','CANCELLED','ARCHIVED']);
export const segmentStatusSchema = z.enum(['BOOKED','CONFIRMED','CHANGED','CANCELLED','COMPLETED','UNKNOWN']);
export const expenseCreateSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  category: z.string().max(100).optional(),
  merchant_or_description: z.string().min(1).max(500),
  incurred_at: z.string().datetime(),
  traveler_id: z.string().uuid().optional(),
  location: z.string().max(300).optional()
});
export const correctionSchema = z.object({
  entity_type: z.enum(['TRIP','SEGMENT','CONNECTION','BUDGET','EXPENSE','PREFERENCE_SET']),
  entity_id: z.string().uuid(),
  field_name: z.string().min(1).max(100),
  new_value: z.unknown(),
  timezone: z.string().optional(),
  reason: z.string().max(500).optional(),
  row_version: z.number().int().positive().optional()
});
const manualSegmentSchema = z.object({
  segment_type: z.string().min(1).max(100),
  supplier_name: z.string().max(200).optional().nullable(),
  booking_reference: z.string().max(200).optional().nullable(),
  departure_local: z.string().optional().nullable(),
  departure_timezone: z.string().optional().nullable(),
  arrival_local: z.string().optional().nullable(),
  arrival_timezone: z.string().optional().nullable(),
  departure_location: z.string().max(300).optional().nullable(),
  arrival_location: z.string().max(300).optional().nullable(),
  status: segmentStatusSchema.optional(),
});

const manualStructuredTripSchema = z.object({
  title: z.string().min(1).max(200),
  start_at: z.string().optional().nullable(),
  end_at: z.string().optional().nullable(),
  start_timezone: z.string().optional().nullable(),
  end_timezone: z.string().optional().nullable(),
  segments: z.array(manualSegmentSchema).min(1).max(100),
});

export const manualIngestionSchema = z.object({
  trip_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  source_text: z.string().max(100_000).optional(),
  structured_trip: manualStructuredTripSchema.optional(),
}).refine(v => Boolean(v.structured_trip || v.source_text?.trim()), { message: 'source_text or structured_trip is required' });
export const textIngestionSchema = z.object({
  trip_id: z.string().uuid().optional(),
  text: z.string().min(1).max(100_000),
  source_reference: z.string().max(500).optional()
});

export type ExtractionCandidate = {
  entity_type: string;
  field_name: string;
  candidate_value: unknown;
  normalized_value?: unknown;
  confidence: number;
  source_location?: { start: number; end: number } | { page: number; start?: number; end?: number };
  source_excerpt?: string;
};

export type ExtractedTrip = {
  title?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  start_timezone?: string | null;
  end_timezone?: string | null;
  segments: Array<{
    segment_type: string;
    supplier_name?: string | null;
    booking_reference?: string | null;
    departure_local?: string | null;
    departure_timezone?: string | null;
    arrival_local?: string | null;
    arrival_timezone?: string | null;
    departure_location?: string | null;
    arrival_location?: string | null;
    status?: 'BOOKED'|'CONFIRMED'|'CHANGED'|'CANCELLED'|'COMPLETED'|'UNKNOWN';
  }>;
};
