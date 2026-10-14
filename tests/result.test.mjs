import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { makeObservation } from '../src/result.js';

globalThis.crypto ??= webcrypto;

const query = {
  adapter: 'miles-and-more', origin: 'BRU', destination: 'SLC',
  outboundDate: '2027-05-17', returnDate: '2027-05-28',
  tripType: 'roundtrip', adults: 2, cabin: 'business'
};

test('available observation gets found_at and normalized fields', () => {
  const row = makeObservation({
    runId: 'run-1', query, attempt: 2, sourceUrl: 'https://example.test',
    parsed: { status: 'AVAILABLE', mileagePrice: 125000, fees: 312.5, currency: 'EUR', flightNumbers: ['LH123'] }
  });
  assert.equal(row.status, 'AVAILABLE');
  assert.equal(row.origin, 'BRU');
  assert.equal(row.mileage_price, 125000);
  assert.equal(row.fees_currency, 'EUR');
  assert.ok(row.found_at);
  assert.equal(row.sync_status, 'PENDING');
});

test('itinerary-level M&M offer fields are retained for historical comparison', () => {
  const row = makeObservation({
    runId:'run-4', query, attempt:1, sourceUrl:'https://example.test',
    parsed:{status:'AVAILABLE',mileagePrice:25000,fees:296.75,feesCurrency:'EUR',departureTime:'08:40',arrivalTime:'13:45',connections:1,durationMinutes:785,operatingCarrier:'Lufthansa',observedCabin:'economy',itineraryStage:'OUTBOUND_SELECTION'}
  });
  assert.equal(row.departure_time,'08:40');
  assert.equal(row.arrival_time,'13:45');
  assert.equal(row.observed_cabin,'economy');
  assert.equal(row.itinerary_stage,'OUTBOUND_SELECTION');
  assert.match(row.itinerary_key,/BRU\|SLC\|2027-05-17\|08:40\|13:45\|1\|LUFTHANSA\|ECONOMY/);
});

test('non-available observation does not claim found_at', () => {
  const row = makeObservation({ runId: 'run-2', query, attempt: 1, sourceUrl: '', parsed: { status: 'INCONCLUSIVE' } });
  assert.equal(row.found_at, '');
});

test('raw excerpt is capped', () => {
  const row = makeObservation({ runId: 'run-3', query, attempt: 1, sourceUrl: '', parsed: { rawExcerpt: 'x'.repeat(3000) } });
  assert.equal(row.raw_excerpt.length, 1800);
});
