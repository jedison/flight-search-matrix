import test from 'node:test';
import assert from 'node:assert/strict';
import { enterNativeDateDigits, validateSubmittedDates } from '../src/mm-native-dates.js';

test('native date entry clears, types compact digits once, commits with Tab, and detaches',async()=>{
  const events=[];
  const api={attach:async()=>events.push('attach'),detach:async()=>events.push('detach'),sendCommand:async(_,method,params)=>events.push({method,...params})};
  await enterNativeDateDigits(api,9,'1705202727052027');
  assert.equal(events[0],'attach');
  assert.deepEqual(events[1].commands,['selectAll']);
  assert.equal(events.filter(e=>e.text).map(e=>e.text).join(''),'1705202727052027');
  assert.equal(events.at(-3).key,'Tab');
  assert.equal(events.at(-2).type,'keyUp');
  assert.equal(events.at(-1),'detach');
});

test('date entry failures and cancellation detach and stop further typing',async()=>{
  let detached=0, commands=0;
  const api={attach:async()=>{},detach:async()=>detached++,sendCommand:async()=>{commands++;throw new Error('disconnected');}};
  await assert.rejects(enterNativeDateDigits(api,9,'17052027'),/disconnected/);
  assert.equal(detached,1); assert.equal(commands,1);
  await assert.rejects(enterNativeDateDigits(api,9,'17052027',()=>true),/stopped/);
  assert.equal(detached,2); assert.equal(commands,1);
});

test('submitted dates reject the observed blank payload and accept the manual reference',()=>{
  const query={tripType:'roundtrip',outboundDate:'2027-05-17',returnDate:'2027-05-27'};
  const payload=dates=>({itineraries:dates.map(departureDateTime=>({departureDateTime}))});
  assert.equal(validateSubmittedDates(payload(['','']),query),false);
  assert.equal(validateSubmittedDates(payload(['2027-05-17','2027-05-27']),query),true);
  assert.equal(validateSubmittedDates(payload(['2027-05-17','2027-05-28']),query),false);
  assert.equal(validateSubmittedDates(null,query),false);
  assert.equal(validateSubmittedDates(payload(['2027-05-17']),{...query,tripType:'oneway'}),true);
  assert.equal(validateSubmittedDates(payload(['2027-05-17','2027-05-27']),{...query,tripType:'oneway'}),false);
});
