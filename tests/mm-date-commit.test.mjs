import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../src/content/miles-and-more.js',import.meta.url),'utf8');
function harness(update=()=>{}, cancelled=()=>false) {
  let now=0;
  const fields={};
  const events=[];
  const context=vm.createContext({
    Date:{now:()=>now},
    deepAll:selector=>fields[selector]?[fields[selector]]:[],
    sleep:async ms=>{now+=ms;update(now,fields);},
    activity:(_id,step)=>events.push(step),
    runControl:()=>cancelled(now)?'CANCELLED':null,
  });
  for(const name of ['formattedDate','committedTravelDates','waitForCommittedTravelDates']) {
    const match=source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n  \\}`));
    assert.ok(match,name);
    vm.runInContext(match[0],context);
  }
  return {context,fields,events,time:()=>now};
}
function field(iso,value=iso.split('-').reverse().join('/'),valid=true) {
  return {value,validity:{valid},getAttribute:()=>iso};
}
const out='2027-05-17',back='2027-05-27';
test('waits through delayed splitting and validation, not just displayed text',async()=>{
  const h=harness((t,f)=>{
    if(t>=800) {
      f['#id-outbounddate-textfield']=field(t>=1600?out:'','17/05/2027');
      f['#id-inbounddate-textfield']=field(t>=1600?back:'','27/05/2027');
    }
  });
  assert.equal(await h.context.waitForCommittedTravelDates(out,back,'roundtrip','r'),true);
  assert.ok(h.time()>=1850);
  assert.deepEqual(h.events,['DATES_COMMIT_WAIT','DATES_COMMITTED']);
});
test('rejects missing, stale, mismatched and invalid committed dates',()=>{
  const h=harness();
  for(const bad of [undefined,field('2027-01-01'),field(out,'18/05/2027'),field(out,'17/05/2027',false)]) {
    h.fields['#id-outbounddate-textfield']=bad;
    assert.equal(h.context.committedTravelDates(out,back,'oneway'),false);
  }
});
test('round trip needs both dates; one way needs only outbound',()=>{
  const h=harness();
  h.fields['#id-outbounddate-textfield']=field(out);
  assert.equal(h.context.committedTravelDates(out,back,'roundtrip'),false);
  assert.equal(h.context.committedTravelDates(out,null,'oneway'),true);
  h.fields['#id-inbounddate-textfield']=field(back);
  assert.equal(h.context.committedTravelDates(out,back,'roundtrip'),true);
});
test('uncommitted dates time out and log that Search was not clicked',async()=>{
  const h=harness();
  assert.equal(await h.context.waitForCommittedTravelDates(out,back,'roundtrip','r'),false);
  assert.equal(h.time(),6000);
  assert.equal(h.events.at(-1),'DATES_COMMIT_TIMEOUT');
});
test('commit wait respects cancellation',async()=>{
  const h=harness(()=>{},t=>t>=200);
  assert.equal(await h.context.waitForCommittedTravelDates(out,back,'roundtrip','r'),false);
  assert.equal(h.time(),200);
  assert.ok(!h.events.includes('DATES_COMMITTED'));
});
test('both typing and calendar entry pass through commit gate before submission',()=>{
  assert.match(source,/type:'FSM_MM_NATIVE_DATES'/);
  assert.match(source,/runId,digits:compact/);
  assert.match(source,/const datesOk=datesEntered && await waitForCommittedTravelDates/);
  assert.ok(source.indexOf('const datesOk=')<source.indexOf('const submission=await prepareNativeSearchClick'));
  assert.match(source,/travelTypeOk&&finalCabinOk&&originOk&&destinationOk&&datesOk/);
  assert.match(source,/submittedSearch:submittedSearch\(\)/);
});
