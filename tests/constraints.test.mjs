import test from 'node:test';
import assert from 'node:assert/strict';
import { assessItinerary } from '../src/constraints.js';

test('rejects too many stops and blocked connection', () => {
  const result=assessItinerary({connection_count:2,connection_airports:['FRA','ORD'],segments:[]},{maxStops:1,blockedConnectionAirports:'ORD'});
  assert.equal(result.passes,false);
  assert.equal(result.reasons.length,2);
});

test('accepts itinerary inside constraints', () => {
  const result=assessItinerary({connection_count:1,connection_airports:['FRA'],segments:[{operating_carrier:'LH'}]},{maxStops:1,allowedConnectionAirports:'FRA',allowedCarriers:'LH'});
  assert.equal(result.passes,true);
});

