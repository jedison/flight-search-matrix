import test from 'node:test';
import assert from 'node:assert/strict';
import { expandAirportTokens } from '../src/airport-groups.js';

test('expands built-in metro airport groups', () => {
  assert.deepEqual(expandAirportTokens('NYC, BRU'), ['JFK','EWR','LGA','BRU']);
});

test('custom airport groups override and deduplicate', () => {
  assert.deepEqual(expandAirportTokens('WEST, SLC', { WEST:['SLC','DEN'] }), ['SLC','DEN']);
});


test('splits real and escaped newlines into separate airports', () => {
  assert.deepEqual(expandAirportTokens('BRU\nAMS'), ['BRU','AMS']);
  assert.deepEqual(expandAirportTokens('BRU\\nAMS'), ['BRU','AMS']);
});

