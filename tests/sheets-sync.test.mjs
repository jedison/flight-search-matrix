import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeForSheet, normalizeSummaryForSheet } from '../src/sheets-sync.js';
import { RESULT_COLUMNS, SUMMARY_COLUMNS } from '../src/constants.js';

test('result sheet normalization follows RESULT_COLUMNS and flattens arrays', () => {
  const row = { result_id:'r1', flight_numbers:['LH1','UA2'], connections:1 };
  const values = normalizeForSheet(row);
  assert.equal(values.length, RESULT_COLUMNS.length);
  assert.equal(values[RESULT_COLUMNS.indexOf('result_id')], 'r1');
  assert.equal(values[RESULT_COLUMNS.indexOf('flight_numbers')], 'LH1 | UA2');
  assert.equal(values[RESULT_COLUMNS.indexOf('connections')], 1);
});

test('summary sheet normalization follows SUMMARY_COLUMNS', () => {
  const row = { summary_id:'s1', final_status:'AVAILABLE', flight_numbers:['LH1'] };
  const values = normalizeSummaryForSheet(row);
  assert.equal(values.length, SUMMARY_COLUMNS.length);
  assert.equal(values[SUMMARY_COLUMNS.indexOf('summary_id')], 's1');
  assert.equal(values[SUMMARY_COLUMNS.indexOf('flight_numbers')], 'LH1');
});

import { normalizeRunForSheet, normalizeCurrentBestForSheet } from '../src/sheets-sync.js';
import { RUN_COLUMNS, CURRENT_BEST_COLUMNS } from '../src/constants.js';

test('run sheet normalization serializes configuration snapshots', () => {
  const values=normalizeRunForSheet({run_id:'run1',search_definition_json:{origins:'BRU'}});
  assert.equal(values.length,RUN_COLUMNS.length);
  assert.equal(values[RUN_COLUMNS.indexOf('run_id')],'run1');
  assert.match(values[RUN_COLUMNS.indexOf('search_definition_json')],/BRU/);
});

test('current best normalization follows CURRENT_BEST_COLUMNS', () => {
  const values=normalizeCurrentBestForSheet({query_key:'k1',final_status:'AVAILABLE'});
  assert.equal(values.length,CURRENT_BEST_COLUMNS.length);
  assert.equal(values[CURRENT_BEST_COLUMNS.indexOf('query_key')],'k1');
});

