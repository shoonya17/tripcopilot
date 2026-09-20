import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeToken, bookingFingerprint } from '../../packages/core/src/dedup.ts';

test('normalization is deterministic', () => {
  assert.equal(normalizeToken('  AI   Express  '), 'ai express');
});

test('booking fingerprint is stable for equivalent normalized inputs', () => {
  const a = bookingFingerprint({ supplier:'AI   Express', bookingReference:' AB-12 ', departureLocation:'DEL', arrivalLocation:'BKK' });
  const b = bookingFingerprint({ supplier:'ai express', bookingReference:'ab-12', departureLocation:'del', arrivalLocation:'bkk' });
  assert.equal(a, b);
});
