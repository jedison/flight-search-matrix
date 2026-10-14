import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchMatrix } from '../src/matrix.js';

test('builds explicit open-jaw legs', () => {
  const rows=buildSearchMatrix({adapter:'manual',origins:'BRU',destinations:'BZN',returnOrigins:'SLC',returnDestinations:'BRU',tripType:'openjaw',outboundStart:'2027-05-17',outboundEnd:'2027-05-17',returnStart:'2027-05-28',returnEnd:'2027-05-28',minNights:10,maxNights:12,adults:2,cabins:['business']});
  assert.equal(rows.length,1);
  assert.deepEqual(rows[0].legs.map(l=>[l.origin,l.destination,l.date]), [['BRU','BZN','2027-05-17'],['SLC','BRU','2027-05-28']]);
  assert.equal(rows[0].returnOrigin,'SLC');
});

test('one-way creates one leg only', () => {
  const [row]=buildSearchMatrix({origins:'BRU',destinations:'SLC',tripType:'oneway',outboundStart:'2027-05-17',outboundEnd:'2027-05-17',adults:1,cabins:['economy']});
  assert.equal(row.legs.length,1);
  assert.equal(row.returnDate,'');
});

