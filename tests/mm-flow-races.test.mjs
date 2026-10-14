import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const adapter=await readFile(new URL('../src/content/miles-and-more.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../src/service-worker.js',import.meta.url),'utf8');
function extract(source,name,context) {
  const indent=source===adapter?'  ':'';
  const match=source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n${indent}\\}`));
  assert.ok(match,name);
  vm.runInContext(match[0],context);
}
test('exact cabin state rejects premium economy for an economy request',()=>{
  let value='PE';
  const ctx=vm.createContext({norm:v=>String(v).toLowerCase(),deepAll:()=>[{value}]});
  for(const f of ['cabinCode','cabinMatches']) extract(adapter,f,ctx);
  assert.equal(ctx.cabinMatches('economy'),false);
  assert.equal(ctx.cabinMatches('premium economy'),true);
  value='E';
  assert.equal(ctx.cabinMatches('economy'),true);
  assert.equal(ctx.cabinMatches('premium'),false);
  assert.equal(ctx.cabinMatches('unknown'),false);
});
test('account balance and recent flight text never become availability or a fare',()=>{
  const ctx=vm.createContext({norm:v=>String(v).toLowerCase(),document:{body:{innerText:'Recent search: LH 123\nYour balance: 430,812 miles'}}});
  for(const f of ['detectBlockingState','parseNumber','resultSignals','fareOffers','itineraryOffers','parseResults']) extract(adapter,f,ctx);
  const result=ctx.parseResults();
  assert.equal(result.status,'INCONCLUSIVE');
  assert.equal(result.mileagePrice,undefined);
  assert.equal(result.flightNumbers,undefined);
});
test('result-page fare cards retain every requested-cabin offer while exposing a compact best offer',()=>{
  const page=`Flight results on Monday, 17 May 2027\nBelow are 14 flights from Brussels to Denver.\nEconomy\nfrom\n25,420\nMiles\n+\nEUR296.75\n*\nPremium Economy\nMixed classes\nfrom\n51,775\nMiles\n+\nEUR452.75\n*\nEconomy\nfrom\n25,000\nMiles\n+\nEUR303.68\n*\nEconomy\nfrom\n25,000\nMiles\n+\nEUR296.75\n*`;
  const ctx=vm.createContext({norm:v=>String(v).toLowerCase().replace(/\s+/g,' ').trim(),document:{body:{innerText:page}}});
  for(const f of ['detectBlockingState','parseNumber','resultSignals','fareOffers','itineraryOffers','parseResults']) extract(adapter,f,ctx);
  const result=ctx.parseResults({cabin:'economy'});
  assert.equal(result.status,'AVAILABLE');
  assert.equal(result.mileagePrice,25000);
  assert.equal(result.fees,296.75);
  assert.equal(result.feesCurrency,'EUR');
  assert.equal(result.observationCandidates.length,3);
  assert.deepEqual(Array.from(result.observationCandidates,offer=>offer.fees),[296.75,303.68,296.75]);
  assert.match(result.statusDetail,/14 flights/);
});
for(const phase of ['before','attach','move','down']) test(`stop is respected at native click phase: ${phase}`,async()=>{
  const state={stopRequested:phase==='before',paused:false};
  const commands=[];
  let detached=false;
  const ctx=vm.createContext({state,delay:async()=>{},recordActivity:()=>{},sendToTab:async()=>({ok:true,target:{x:100,y:100}}),chrome:{debugger:{
    attach:async()=>{if(phase==='attach')state.stopRequested=true;},
    sendCommand:async(_d,_c,p)=>{
      commands.push(p);
      if((phase==='move'&&p.type==='mouseMoved')||(phase==='down'&&p.type==='mousePressed'))state.stopRequested=true;
    },
    detach:async()=>{detached=true;}
  }}});
  extract(worker,'clickMilesSearchWithNativeInput',ctx);
  assert.equal((await ctx.clickMilesSearchWithNativeInput(1,{x:100,y:100})).control,'CANCELLED');
  assert.equal(detached,phase!=='before');
  if(phase==='down') {
    assert.equal(commands.at(-1).type,'mouseReleased');
    assert.equal(commands.at(-1).x,-1);
    assert.equal(commands.at(-1).buttons,0);
  } else assert.ok(!commands.some(p=>p.type==='mousePressed'));
});
test('pause during debugger attachment prevents a click',async()=>{
  const state={};let detached=false;
  const ctx=vm.createContext({state,recordActivity:()=>{},sendToTab:async()=>({ok:true,target:{}}),chrome:{debugger:{attach:async()=>{state.paused=true;},detach:async()=>{detached=true;},sendCommand:async()=>assert.fail('click after pause')}}});
  extract(worker,'clickMilesSearchWithNativeInput',ctx);
  assert.equal((await ctx.clickMilesSearchWithNativeInput(1,{})).control,'PAUSED');
  assert.equal(detached,true);
});
test('normal native click presses and releases once, then detaches',async()=>{
  const events=[];
  const ctx=vm.createContext({state:{},delay:async()=>{},recordActivity:()=>{},sendToTab:async()=>({ok:true,target:{x:10,y:20}}),chrome:{debugger:{attach:async()=>{},sendCommand:async(_d,_c,p)=>events.push(p.type),detach:async()=>events.push('detach')}}});
  extract(worker,'clickMilesSearchWithNativeInput',ctx);
  assert.equal((await ctx.clickMilesSearchWithNativeInput(1,{x:10,y:20})).ok,true);
  assert.deepEqual(events,['mouseMoved','mousePressed','mouseReleased','detach']);
});
test("native click does not hold M&M's reactive Search flights control between press and release",()=>{
  const nativeClick=worker.match(/async function clickMilesSearchWithNativeInput\([^]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(nativeClick,/await delay\(80\)/);
  assert.match(nativeClick,/mouseMoved[\s\S]*await delay\(120\)[\s\S]*mousePressed/);
  assert.match(nativeClick,/FSM_MM_RECHECK_NATIVE_TARGET/);
  assert.match(nativeClick,/mousePressed[\s\S]*const interrupted=control\(\);[\s\S]*mouseReleased/);
});
test('retry refreshes stale booking snapshot and returns from results to booking',async()=>{
  const updates=[];
  const ctx=vm.createContext({state:{runId:'r'},DEFAULT_SETTINGS:{},chrome:{tabs:{
    get:async()=>({id:1,status:'complete',url:'https://shop.miles-and-more.com/reward/reward/availability'}),
    update:async(_id,p)=>updates.push(p.url)
  }},setPhase:()=>{},recordActivity:()=>{},waitForTabComplete:async()=>{},waitForMilesFormReady:async()=>({control:'CANCELLED'})});
  extract(worker,'executeMilesAndMoreQuery',ctx);
  const booking='https://www.miles-and-more.com/be/en/spend/flights/flight-award.html';
  await ctx.executeMilesAndMoreQuery({id:1,url:booking,status:'complete'},{tripType:'roundtrip'},{mmSearchPageUrl:booking});
  assert.deepEqual(updates,[booking]);
});
test('result waiting also recognizes a parsed result page that keeps the same URL',()=>{
  assert.match(worker,/FSM_PARSE_RESULTS/);
  assert.match(worker,/\['AVAILABLE','NO_RESULT'\]\.includes/);
  assert.match(worker,/RESULT_SURFACE/);
});
test('prepared M&M dates are carried into result navigation instead of waiting for booking-page state',()=>{
  assert.match(worker,/waitForMilesResultNavigation\(tab\.id,beforeSubmit,waitMs,query,response\.submittedSearch\)/);
  assert.match(worker,/let submitted=\{search:preparedSearch\}/);
  assert.match(worker,/submissionDeadline/);
  assert.match(worker,/SUBMITTED_DATES_PREPARED/);
  assert.match(worker,/SUBMITTED_DATES_COMMITTED/);
  assert.doesNotMatch(worker,/M&M did not prepare the requested submission dates/);
});

test('blank prepared M&M submission dates stop before Search flights is clicked',()=>{
  assert.match(worker,/SUBMITTED_DATES_REJECTED/);
  assert.match(worker,/prepared a submission with missing or incorrect travel dates\. Search flights was not clicked/);
});
test('result parsing reconnects the content adapter after availability-page navigation',()=>{
  assert.match(worker,/async function waitForMilesResultAdapter/);
  assert.match(worker,/M_AND_M_RESULT_ADAPTER_REFRESH/);
  assert.match(worker,/type:'FSM_PARSE_RESULTS'/);
  assert.match(worker,/waitForMilesResultAdapter\(tabId,state\.runId,query/);
});
test('exhausted inconclusive queries determine final run status',()=>{
  const line=worker.match(/const status = runError[^\n]+/)[0];
  const run=(overrides={})=>vm.runInNewContext(`${line}\nstatus`,{runError:null,state:{stopRequested:false,needsUser:false},inconclusiveQueries:1,...overrides});
  assert.equal(run(),'INCONCLUSIVE');
  assert.equal(run({inconclusiveQueries:0}),'COMPLETE');
  assert.equal(run({state:{needsUser:true}}),'NEEDS_USER');
  assert.equal(run({state:{stopRequested:true}}),'STOPPED');
  assert.equal(run({runError:Error('failed')}),'ERROR');
  assert.match(worker,/if\(!sawAvailable && completedNoResultAttempts!==retries/);
});
test('cabin is selected after airports and rechecked before native preparation',()=>{
  const run=adapter.slice(adapter.indexOf('async function runQuery'));
  assert.ok(run.indexOf("fillAirport('destination'")<run.indexOf('await setCabin'));
  assert.ok(run.indexOf('cabinMatches(query.cabin)')<run.indexOf('await prepareNativeSearchClick(runId)'));
});
test('native click preparation waits for the target recheck before reporting ready',()=>{
  const run=adapter.slice(adapter.indexOf('async function runQuery'));
  const prepare=adapter.match(/async function prepareNativeSearchClick\([^]*?\n  \}/)?.[0] || '';
  assert.match(prepare,/await sleep\(180\)/);
  assert.match(prepare,/document\.elementFromPoint/);
  assert.match(prepare,/SEARCH_FLIGHTS_TARGET/);
  assert.match(run,/await prepareNativeSearchClick\(runId\)/);
  assert.match(adapter,/function recheckNativeSearchClickTarget/);
  assert.match(adapter,/SEARCH_FLIGHTS_TARGET_REFRESHED/);
});
