import test from 'node:test';
import assert from 'node:assert/strict';
import { resultsToCsv } from '../src/csv.js';
import { RESULT_COLUMNS } from '../src/constants.js';

test('CSV includes stable header ordering', () => {
  const csv = resultsToCsv([]);
  assert.equal(csv, RESULT_COLUMNS.join(','));
});

test('CSV escapes commas, quotes and arrays', () => {
  const row = Object.fromEntries(RESULT_COLUMNS.map(key => [key, '']));
  row.result_id = 'r1';
  row.status_detail = 'fare, then "tax"';
  row.flight_numbers = ['LH1', 'UA2'];
  const csv = resultsToCsv([row]);
  assert.match(csv, /"fare, then ""tax"""/);
  assert.match(csv, /LH1 \| UA2/);
});

