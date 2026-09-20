import { z } from 'zod';
import type { ExtractedTrip } from './types.js';

export type ValidationIssue = { code: string; message: string; field?: string };
export type ValidationOutcome = { result: 'VALID' | 'REVIEW_REQUIRED' | 'REJECTED'; issues: ValidationIssue[] };

const isoDateOrNull = z.string().datetime().nullable().optional();

export function validateExtractedTrip(input: ExtractedTrip): ValidationOutcome {
  const issues: ValidationIssue[] = [];
  const schema = z.object({
    title: z.string().nullable().optional(),
    start_at: isoDateOrNull,
    end_at: isoDateOrNull,
    start_timezone: z.string().nullable().optional(),
    end_timezone: z.string().nullable().optional(),
    segments: z.array(z.object({
      segment_type: z.string().min(1),
      supplier_name: z.string().nullable().optional(),
      booking_reference: z.string().nullable().optional(),
      departure_local: z.string().nullable().optional(),
      departure_timezone: z.string().nullable().optional(),
      arrival_local: z.string().nullable().optional(),
      arrival_timezone: z.string().nullable().optional(),
      departure_location: z.string().nullable().optional(),
      arrival_location: z.string().nullable().optional(),
      status: z.enum(['BOOKED','CONFIRMED','CHANGED','CANCELLED','COMPLETED','UNKNOWN']).optional()
    })).min(1)
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { result: 'REJECTED', issues: parsed.error.issues.map(i => ({ code: 'STRUCTURAL_INVALID', message: i.message, field: i.path.join('.') })) };

  for (const [index, segment] of parsed.data.segments.entries()) {
    if (!segment.departure_local && !segment.departure_location) {
      issues.push({ code: 'MISSING_MATERIAL_INFORMATION', field: `segments.${index}.departure`, message: 'Departure evidence is missing.' });
    }
    if (!segment.arrival_local && !segment.arrival_location) {
      issues.push({ code: 'MISSING_MATERIAL_INFORMATION', field: `segments.${index}.arrival`, message: 'Arrival evidence is missing.' });
    }
    if (segment.departure_local && segment.arrival_local) {
      const dep = new Date(segment.departure_local).getTime();
      const arr = new Date(segment.arrival_local).getTime();
      if (!Number.isNaN(dep) && !Number.isNaN(arr) && arr < dep) {
        issues.push({ code: 'CROSS_ENTITY_CONFLICT', field: `segments.${index}`, message: 'Arrival precedes departure.' });
      }
    }
  }
  if (issues.some(i => i.code === 'CROSS_ENTITY_CONFLICT')) return { result: 'REVIEW_REQUIRED', issues };
  if (issues.length) return { result: 'REVIEW_REQUIRED', issues };
  return { result: 'VALID', issues: [] };
}
