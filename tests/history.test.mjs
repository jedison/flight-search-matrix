import test from 'node:test';
import assert from 'node:assert/strict';
import { historicalStats, chooseCurrentBest } from '../src/history.js';

test('history retains minimum prices and detects reappearance', () => {
  const rows=[
    {status:'AVAILABLE',checked_at:'2026-08-01T00:00:00Z',found_at:'2026-08-01T00:00:00Z',mileage_price:140000},
    {status:'NO_RESULT',checked_at:'2026-08-02T00:00:00Z'},
    {status:'AVAILABLE',checked_at:'2026-08-03T00:00:00Z',found_at:'2026-08-03T00:00:00Z',mileage_price:125000}
  ];
  const s=historicalStats(rows);
  assert.equal(s.minimum_mileage_ever,125000);
  assert.equal(s.availability_reappeared,true);
});

test('current best prefers available and lower mileage', () => {
  const best=chooseCurrentBest([{final_status:'NO_RESULT_REPEATED',last_checked_at:'2026-08-03'},{final_status:'AVAILABLE',best_mileage_price:140000,last_checked_at:'2026-08-01'},{final_status:'AVAILABLE',best_mileage_price:125000,last_checked_at:'2026-08-02'}]);
  assert.equal(best.best_mileage_price,125000);
});

test('current best breaks a mileage tie using fees', () => {
  const best=chooseCurrentBest([
    {final_status:'AVAILABLE',best_mileage_price:25000,best_fees:303.68,last_checked_at:'2026-09-09T10:00:00Z'},
    {final_status:'AVAILABLE',best_mileage_price:25000,best_fees:296.75,last_checked_at:'2026-09-09T09:00:00Z'}
  ]);
  assert.equal(best.best_fees,296.75);
});
