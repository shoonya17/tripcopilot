import test from 'node:test';
import assert from 'node:assert/strict';
import { zonedDateTimeToUtc, deriveRightNow } from '../../packages/core/src/time.ts';

test('converts a timezone-less local datetime to the correct UTC instant', () => {
  assert.equal(zonedDateTimeToUtc('2026-10-04T09:00:00', 'Asia/Kolkata')?.toISOString(), '2026-10-04T03:30:00.000Z');
  assert.equal(zonedDateTimeToUtc('2026-10-04T09:00:00', 'Asia/Singapore')?.toISOString(), '2026-10-04T01:00:00.000Z');
});

test('preserves explicit offsets without double applying a timezone', () => {
  assert.equal(zonedDateTimeToUtc('2026-10-04T09:00:00+05:30', 'Asia/Kolkata')?.toISOString(), '2026-10-04T03:30:00.000Z');
});

test('Right Now selects the earliest upcoming segment', () => {
  const now = new Date('2026-10-04T03:00:00Z');
  const view = deriveRightNow([
    { segmentId:'late', supplierName:'B', bookingReference:null, departureUtc:new Date('2026-10-04T05:00:00Z'), departureLocation:'BOM', arrivalLocation:'BKK', departureTimezone:'Asia/Kolkata', status:'CONFIRMED' },
    { segmentId:'early', supplierName:'A', bookingReference:'X1', departureUtc:new Date('2026-10-04T04:00:00Z'), departureLocation:'DEL', arrivalLocation:'BOM', departureTimezone:'Asia/Kolkata', status:'CONFIRMED' },
  ], now);
  assert.equal(view.segmentId, 'early');
  assert.equal(view.bookingReference, 'X1');
});
