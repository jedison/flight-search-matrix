import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { summarizeQuery, queryKey } from '../src/query-summary.js';

globalThis.crypto ??= webcrypto;

const query = { queryId:'q1', adapter:'miles-and-more', origin:'BRU', destination:'SLC', outboundDate:'2027-05-17', returnDate:'2027-05-28', tripType:'roundtrip', adults:2, cabin:'business' };

test('available observation wins and best prices are retained', () => {
  const summary = summarizeQuery({ runId:'run1', query, observations:[
    { status:'NO_RESULT', checked_at:'2026-08-29T10:00:00Z', mileage_price:'', cash_price:'', fees:'', flight_numbers:[] },
    { status:'AVAILABLE', checked_at:'2026-08-29T10:01:00Z', found_at:'2026-08-29T10:01:00Z', mileage_price:125000, cash_price:900, cash_total_per_person:900, price_comparable:true, currency:'EUR', fees:240, fees_currency:'EUR', flight_numbers:['LH123'] },
    { status:'AVAILABLE', checked_at:'2026-08-29T10:02:00Z', found_at:'2026-08-29T10:02:00Z', mileage_price:110000, cash_price:950, cash_total_per_person:950, price_comparable:true, currency:'EUR', fees:220, fees_currency:'EUR', flight_numbers:['LH123','UA45'] }
  ]});
  assert.equal(summary.final_status, 'AVAILABLE');
  assert.equal(summary.best_mileage_price, 110000);
  assert.equal(summary.best_cash_price, 900);
  assert.equal(summary.best_fees, 220);
  assert.equal(summary.available_attempts, 2);
  assert.deepEqual(summary.flight_numbers, ['LH123','UA45']);
});

test('query key is stable across retries', () => {
  assert.equal(queryKey(query), 'miles-and-more|BRU-SLC:2027-05-17>SLC-BRU:2027-05-28|roundtrip|2|business');
});

test('summary keeps the fee paired with the best mileage offer and counts attempts once', () => {
  const summary = summarizeQuery({ runId:'run2', query, observations:[
    {status:'AVAILABLE',attempt:1,mileage_price:25000,fees:303.68,fees_currency:'EUR',checked_at:'2026-09-09T10:00:00Z'},
    {status:'AVAILABLE',attempt:1,mileage_price:25000,fees:296.75,fees_currency:'EUR',checked_at:'2026-09-09T10:00:00Z'},
    {status:'AVAILABLE',attempt:1,mileage_price:25420,fees:250,fees_currency:'EUR',checked_at:'2026-09-09T10:00:00Z'}
  ]});
  assert.equal(summary.best_mileage_price,25000);
  assert.equal(summary.best_fees,296.75);
  assert.equal(summary.attempts_recorded,1);
  assert.equal(summary.available_attempts,1);
});
