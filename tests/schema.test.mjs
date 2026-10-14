import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuery, normalizeItinerary, SCHEMA_VERSION } from '../src/schema.js';

test('normalizes legacy round-trip query into legs', () => {
  const q=normalizeQuery({origin:'BRU',destination:'SLC',outboundDate:'2027-05-17',returnDate:'2027-05-28',tripType:'roundtrip'});
  assert.equal(q.schemaVersion,SCHEMA_VERSION);
  assert.equal(q.legs.length,2);
  assert.equal(q.legs[1].origin,'SLC');
  assert.equal(q.legs[1].destination,'BRU');
});

test('normalizes segment-based itinerary', () => {
  const i=normalizeItinerary({segments:[{origin:'BRU',destination:'FRA',flightNumber:'LH100'},{origin:'FRA',destination:'SLC',flightNumber:'LH200'}]});
  assert.equal(i.connection_count,1);
  assert.deepEqual(i.connection_airports,['FRA']);
});

