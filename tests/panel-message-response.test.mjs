import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../sidepanel.js',import.meta.url),'utf8');
const start=source.indexOf('chrome.runtime.onMessage.addListener(');
const end=source.indexOf('\n(async()=>{',start);

test('open panel does not steal an asynchronous native-date worker response',async()=>{
  let listener;
  vm.runInNewContext(source.slice(start,end),{
    chrome:{runtime:{onMessage:{addListener:fn=>listener=fn}}},console
  });
  const panelResponse=listener({type:'FSM_MM_NATIVE_DATES',digits:'1705202727052027'});
  assert.equal(panelResponse,false,'UI must not return a promise or claim the reply channel');
  // Model Chrome: a promise returned by a listener competes with worker replies.
  const responses=[new Promise(resolve=>setTimeout(()=>resolve({ok:true}),5))];
  if(panelResponse?.then) responses.push(panelResponse);
  assert.deepEqual(await Promise.race(responses),{ok:true});
});

test('panel still processes run status broadcasts without answering them',()=>{
  let listener;
  const updates=[];
  vm.runInNewContext(source.slice(start,end),{
    chrome:{runtime:{onMessage:{addListener:fn=>listener=fn}}},console,
    setRunState:(...args)=>updates.push(args)
  });
  assert.equal(listener({type:'RUN_STATE',phase:'ACTIVE',detail:'Typing dates'}),false);
  assert.deepEqual(updates,[['ACTIVE','Typing dates']]);
});
