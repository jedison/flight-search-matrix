import test from 'node:test';
import assert from 'node:assert/strict';
import { historyDetailHtml } from '../src/history-detail.js';

test('history detail presents recent reasons and summarizes older attempts', () => {
  const rows = [
    {checked_at:'2026-09-09T13:52:37',status:'NEEDS_USER',attempt:1,status_detail:'Miles & More needs authentication.',mileage_price:'',cash_total_per_person:'',cash_price:''},
    {checked_at:'2026-09-07T16:41:08',status:'NEEDS_USER',attempt:1,status_detail:'Miles & More did not confirm travel dates.',mileage_price:'',cash_total_per_person:'',cash_price:''},
    {checked_at:'2026-09-07T16:37:26',status:'NEEDS_USER',attempt:1,status_detail:'Miles & More did not confirm travel dates.',mileage_price:'',cash_total_per_person:'',cash_price:''},
    {checked_at:'2026-09-07T14:04:58',status:'INCONCLUSIVE',attempt:1,status_detail:'Search page loaded without result cards.',mileage_price:'',cash_total_per_person:'',cash_price:''}
  ];
  const html = historyDetailHtml(rows);
  assert.match(html, /4 observations recorded: 3 NEEDS_USER, 1 INCONCLUSIVE/);
  assert.match(html, /Miles &amp; More needs authentication/);
  assert.match(html, /1 older observation retained in the downloadable diagnostic/);
  assert.equal((html.match(/history-attempt-heading/g) || []).length, 3);
  assert.doesNotMatch(html, /Search page loaded without result cards/);
});
