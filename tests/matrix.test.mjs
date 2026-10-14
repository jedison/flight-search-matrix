import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { buildSearchMatrix } from '../src/matrix.js';

globalThis.crypto ??= webcrypto;

test('builds route/date/cabin combinations with stay filters', () => {
  const tasks = buildSearchMatrix({
    origins: 'BRU',
    destinations: 'SLC,DEN',
    outboundStart: '2027-05-17',
    outboundEnd: '2027-05-18',
    returnStart: '2027-05-27',
    returnEnd: '2027-05-28',
    minNights: 9,
    maxNights: 11,
    adults: 2,
    cabins: ['economy', 'business'],
    tripType: 'roundtrip',
    adapter: 'miles-and-more'
  });
  assert.equal(tasks.length, 16);
  assert.ok(tasks.every(t => t.origin === 'BRU'));
  assert.ok(tasks.some(t => t.destination === 'DEN'));
});

test('deduplicates airport lists', () => {
  const tasks = buildSearchMatrix({
    origins: 'bru, BRU', destinations: 'slc\nSLC',
    outboundStart: '2027-05-17', outboundEnd: '2027-05-17',
    returnStart: '2027-05-28', returnEnd: '2027-05-28',
    minNights: 1, maxNights: 20, adults: 2, cabins: ['business'], tripType: 'roundtrip'
  });
  assert.equal(tasks.length, 1);
});

test('builds all routes from distinct newline, comma and semicolon airport input', () => {
  const shared={
    outboundStart:'2027-05-17', outboundEnd:'2027-05-17',
    returnStart:'2027-05-28', returnEnd:'2027-05-28',
    minNights:1, maxNights:20, adults:1, cabins:['economy'], tripType:'roundtrip'
  };
  const newline=buildSearchMatrix({...shared,origins:'BRU\nAMS',destinations:'SLC\nDEN'});
  const delimited=buildSearchMatrix({...shared,origins:'BRU, AMS',destinations:'SLC; DEN'});
  for(const tasks of [newline,delimited]) {
    assert.equal(tasks.length,4);
    assert.deepEqual(new Set(tasks.map(task=>task.origin)),new Set(['BRU','AMS']));
    assert.deepEqual(new Set(tasks.map(task=>task.destination)),new Set(['SLC','DEN']));
  }
});
