import { DEFAULT_SETTINGS, STATUS, SCHEMA_VERSION } from './constants.js';
import { saveResult, saveRun, saveSummary } from './db.js';
import { makeObservation } from './result.js';
import { summarizeQuery } from './query-summary.js';
import { effectivePolicy, delayForAttempt } from './provider-policy.js';
import { enterNativeDateDigits, validateSubmittedDates } from './mm-native-dates.js';

const ACTIVE_RUN_KEY = 'activeRun';
const LIVE_BROWSER_GATE_KEY = 'latestLiveBrowserGate';
const PINNED_M_AND_M_OVERLAY_KEY = 'pinnedMilesAndMoreOverlay';
const state = { running:false, paused:false, stopRequested:false, recoverable:false, runId:null, completed:0, total:0, phase:'IDLE', detail:'Idle.', activity:[], automationTabId:null, mode:'matrix', needsUser:false, needsUserDetail:'' };

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get('settings');
  if (!stored.settings) await chrome.storage.local.set({ settings:{...DEFAULT_SETTINGS} });
  await restoreRecoverableState();
});
chrome.runtime.onStartup.addListener(restoreRecoverableState);
restoreRecoverableState().catch(() => {});

async function restoreRecoverableState() {
  const { activeRun } = await chrome.storage.local.get(ACTIVE_RUN_KEY);
  if (activeRun && !activeRun.finished) {
    Object.assign(state, { running:false, paused:true, stopRequested:false, recoverable:true, runId:activeRun.runId, completed:activeRun.nextIndex || 0, total:activeRun.tasks?.length || 0, phase:'PAUSED', detail:'Interrupted run recoverable - '+(activeRun.nextIndex || 0)+'/'+(activeRun.tasks?.length || 0)+' completed.' });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FSM_MM_NATIVE_DATES') {
    if (!state.running || state.mode!=='guided-mm-test' || sender.tab?.id!==state.automationTabId || sender.frameId!==0 || message.runId!==state.runId || !/^https:\/\/www\.miles-and-more\.com\//.test(sender.url || '')) {
      sendResponse({ok:false,reason:'Native date entry is restricted to the active guided M&M tab.'}); return false;
    }
    enterNativeDateDigits(chrome.debugger,sender.tab.id,message.digits,()=>state.stopRequested||state.paused)
      .then(()=>sendResponse({ok:true}),error=>sendResponse({ok:false,reason:String(error)}));
    return true;
  }
  if (message.type === 'FSM_UNPIN_M_AND_M_OVERLAY') {
    chrome.storage.local.get('settings').then(({settings={}})=>chrome.storage.local.set({settings:{...settings,mmPinnedOverlay:false},[PINNED_M_AND_M_OVERLAY_KEY]:{active:false}})).then(()=>sendResponse({ok:true}));
    return true;
  }
  if (message.type === 'RUN_MATRIX') {
    if (state.running) { sendResponse({ok:false,error:'A search run is already active.'}); return false; }
    runMatrix(message.tasks, message.settings, {mode:'matrix'}).catch(error => broadcast({ type:'RUN_ERROR', error:String(error) }));
    sendResponse({ ok:true }); return false;
  }
  if (message.type === 'TEST_MILES_AND_MORE') {
    if (state.running) { sendResponse({ok:false,error:'A search run is already active.'}); return false; }
    runMatrix(message.tasks, message.settings, {mode:'guided-mm-test'}).catch(error => broadcast({ type:'RUN_ERROR', error:String(error) }));
    sendResponse({ok:true}); return false;
  }
  if (message.type === 'PAUSE_RUN') {
    if (!state.running) { sendResponse({ok:false,error:'There is no active run to pause.'}); return false; }
    state.paused = true;
    setPhase('PAUSING','Pause requested. The current page action will finish before the run pauses.');
    recordActivity('PAUSE_REQUESTED','Pause requested by you.');
    persistRuntimeFlags().catch(()=>{});
    if (state.automationTabId) chrome.tabs.sendMessage(state.automationTabId,{type:'FSM_PAUSE_RUN',runId:state.runId}).then(() => {
      if (state.paused && !state.stopRequested) { setPhase('PAUSED','M&M confirmed the pause.'); recordActivity('PAUSED','M&M confirmed the pause.'); }
    }).catch(()=>{});
    sendResponse({ok:true}); return false;
  }
  if (message.type === 'RESUME_RUN') {
    if (state.running) { state.paused = false; setPhase('ACTIVE','Resume requested. Continuing with the next safe action.'); recordActivity('RESUME_REQUESTED','Resume requested by you.'); persistRuntimeFlags().catch(()=>{}); sendResponse({ok:true, resumed:true}); return false; }
    resumePersistedRun().catch(error => broadcast({ type:'RUN_ERROR', error:String(error) }));
    sendResponse({ok:true, resumed:true}); return false;
  }
  if (message.type === 'STOP_RUN') {
    if (!state.running) { sendResponse({ok:false,error:'There is no active run to stop.'}); return false; }
    const waitingForUser=state.phase === 'WAITING_FOR_USER';
    state.stopRequested = true; state.paused = false;
    setPhase('STOPPING','Stop requested. Waiting for the active page action to acknowledge cancellation.');
    recordActivity('STOP_REQUESTED','Stop requested by you.');
    persistRuntimeFlags().catch(()=>{});
    if (waitingForUser || !state.automationTabId) acknowledgeStop('No M&M search was submitted by the extension.');
    else chrome.tabs.sendMessage(state.automationTabId,{type:'FSM_CANCEL_RUN',runId:state.runId}).then(() => acknowledgeStop('M&M acknowledged cancellation.')).catch(() => {});
    sendResponse({ok:true}); return false;
  }
  if (message.type === 'ADAPTER_ACTIVITY' && message.runId === state.runId) {
    const phase = state.stopRequested ? state.phase : (message.phase || 'ACTIVE');
    if (!state.stopRequested) setPhase(phase, message.detail || 'M&M is working.');
    recordActivity(message.step || 'M&M',message.detail || 'M&M is working.',phase);
    sendResponse({ok:true}); return false;
  }
  if (message.type === 'GET_RUN_STATE') { getRunState().then(sendResponse); return true; }
  return false;
});

async function getRunState() {
  if (!state.running) await restoreRecoverableState();
  return { ...state };
}
function broadcast(payload) { chrome.runtime.sendMessage(payload).catch(() => {}); }
function pinnedOverlayPayload() { return {active:state.mode==='guided-mm-test',runId:state.runId,phase:state.phase,detail:state.detail,activity:state.activity.slice(-3)}; }
async function syncPinnedMAndMOverlay() {
  const {settings={}}=await chrome.storage.local.get('settings');
  if(!settings.mmPinnedOverlay) return;
  const overlay=pinnedOverlayPayload();
  await chrome.storage.local.set({[PINNED_M_AND_M_OVERLAY_KEY]:overlay});
  if(state.automationTabId) chrome.tabs.sendMessage(state.automationTabId,{type:'FSM_PINNED_M_AND_M_STATUS',overlay}).catch(()=>{});
}
function setPhase(phase, detail) { Object.assign(state,{phase,detail}); broadcast({type:'RUN_STATE',phase,detail,runId:state.runId,completed:state.completed,total:state.total}); syncPinnedMAndMOverlay().catch(()=>{}); }
function recordActivity(step, detail, phase=state.phase) {
  const event={at:new Date().toISOString(),step,detail,phase};
  state.activity.push(event); if (state.activity.length>18) state.activity.shift();
  broadcast({type:'RUN_ACTIVITY',event,activity:[...state.activity],runId:state.runId});
  syncPinnedMAndMOverlay().catch(()=>{});
}
function acknowledgeStop(detail) {
  if (!state.stopRequested) return;
  setPhase('STOPPED',detail);
  recordActivity('STOP_CONFIRMED',detail,'STOPPED');
}
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function providerDelay(settings, adapter, failureStreak=0) { return delayForAttempt(effectivePolicy(settings, adapter), failureStreak); }
async function waitWhilePaused() { while (state.paused && !state.stopRequested) await delay(500); }
function reprioritizeAdjacent(tasks, completedIndex, hit) {
  const before=tasks.slice(0,completedIndex+1);
  const remaining=tasks.slice(completedIndex+1);
  const dateValue=d=>new Date(`${d}T12:00:00Z`).valueOf();
  const hitDate=dateValue(hit.outboundDate);
  remaining.sort((a,b)=>{
    const aMatch=a.origin===hit.origin&&a.destination===hit.destination&&a.cabin===hit.cabin?0:1;
    const bMatch=b.origin===hit.origin&&b.destination===hit.destination&&b.cabin===hit.cabin?0:1;
    if(aMatch!==bMatch)return aMatch-bMatch;
    if(aMatch===0)return Math.abs(dateValue(a.outboundDate)-hitDate)-Math.abs(dateValue(b.outboundDate)-hitDate);
    return (a.priority_score||0)-(b.priority_score||0);
  });
  tasks.splice(0,tasks.length,...before,...remaining);
}

async function persistRuntimeFlags() {
  const { activeRun } = await chrome.storage.local.get(ACTIVE_RUN_KEY);
  if (activeRun && !activeRun.finished) await chrome.storage.local.set({ [ACTIVE_RUN_KEY]:{...activeRun, paused:state.paused, stopRequested:state.stopRequested, updatedAt:new Date().toISOString()} });
}
async function persistRun(run) { await chrome.storage.local.set({ [ACTIVE_RUN_KEY]:run }); }
async function clearRunPersistence(status) {
  const { activeRun } = await chrome.storage.local.get(ACTIVE_RUN_KEY);
  if (activeRun) await chrome.storage.local.set({ [ACTIVE_RUN_KEY]:{...activeRun, finished:true, status, updatedAt:new Date().toISOString()} });
}

function providerConfig(adapter, settings) {
  if (adapter === 'miles-and-more') return { patterns:['https://*.miles-and-more.com/*'], url:settings.mmSearchPageUrl, runType:'FSM_RUN_QUERY', waitType:'FSM_WAIT_FOR_RESULTS' };
  if (adapter === 'lufthansa-cash') return { patterns:['https://*.lufthansa.com/*'], url:settings.lufthansaSearchPageUrl, runType:'FSM_LHG_RUN_QUERY', waitType:'FSM_LHG_WAIT_FOR_RESULTS' };
  if (adapter === 'brussels-airlines-cash') return { patterns:['https://*.brusselsairlines.com/*'], url:settings.brusselsAirlinesSearchPageUrl, runType:'FSM_LHG_RUN_QUERY', waitType:'FSM_LHG_WAIT_FOR_RESULTS' };
  return null;
}
async function getOrCreateAutomationTab(adapter, settings) {
  const config = providerConfig(adapter, settings);
  if (!config) return null;
  if (state.automationTabId) {
    const existing=await chrome.tabs.get(state.automationTabId).catch(()=>null);
    if (existing) return existing;
  }
  return chrome.tabs.create({ url:config.url, active:true });
}
async function waitForTabComplete(tabId, timeoutMs=30000) {
  const initial = await chrome.tabs.get(tabId);
  if (initial.status === 'complete') return initial;
  return new Promise((resolve,reject) => {
    const timeout = setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); reject(new Error('Page load timeout')); }, timeoutMs);
    const listener = (updatedId, changeInfo, tab) => {
      if (updatedId === tabId && changeInfo.status === 'complete') { clearTimeout(timeout); chrome.tabs.onUpdated.removeListener(listener); resolve(tab); }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}
async function sendToTab(tabId, payload, timeoutMs=20000) {
  return Promise.race([chrome.tabs.sendMessage(tabId,payload), new Promise((_,reject)=>setTimeout(()=>reject(new Error('Adapter response timeout')),timeoutMs))]);
}

async function clickMilesSearchWithNativeInput(tabId, target) {
  const control=()=>state.stopRequested?'CANCELLED':state.paused?'PAUSED':null;
  if(control()) return {control:control()};
  const debuggee={tabId};
  await chrome.debugger.attach(debuggee,'1.3');
  recordActivity('NATIVE_DEBUGGER_ATTACHED','Chrome native input attached to the M&M tab.','WAITING_FOR_RESULTS');
  try {
    if(control()) return {control:control()};
    await chrome.debugger.sendCommand(debuggee,'Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x,y:target.y,button:'none',buttons:0,clickCount:0,pointerType:'mouse'});
    // Let M&M settle its hover state before pressing. Releasing remains immediate so
    // its reactive button cannot be replaced between down and up.
    await delay(120);
    if(control()) return {control:control()};
    const refreshed=await sendToTab(tabId,{type:'FSM_MM_RECHECK_NATIVE_TARGET',runId:state.runId},2500).catch(error=>({ok:false,reason:String(error)}));
    if(!refreshed?.ok || !refreshed.target) throw new Error(`M&M could not refresh the Search flights target after hover: ${refreshed?.reason || 'no target returned'}`);
    target=refreshed.target;
    await chrome.debugger.sendCommand(debuggee,'Input.dispatchMouseEvent',{type:'mousePressed',x:target.x,y:target.y,button:'left',buttons:1,clickCount:1,pointerType:'mouse'});
    const interrupted=control();
    // Release outside the button if interrupted after mouse-down; never leave it held.
    await chrome.debugger.sendCommand(debuggee,'Input.dispatchMouseEvent',{type:'mouseReleased',x:interrupted?-1:target.x,y:interrupted?-1:target.y,button:'left',buttons:0,clickCount:1,pointerType:'mouse'});
    if(interrupted) return {control:interrupted};
    recordActivity('NATIVE_CLICK_DISPATCHED','Chrome dispatched one native press and release to Search flights.','WAITING_FOR_RESULTS');
    return {ok:true};
  } finally {
    await chrome.debugger.detach(debuggee).catch(()=>{});
  }
}

async function clickMilesOutboundFareWithNativeInput(tabId, target) {
  const control=()=>state.stopRequested?'CANCELLED':state.paused?'PAUSED':null;
  if(control()) return {control:control()};
  const debuggee={tabId};
  await chrome.debugger.attach(debuggee,'1.3');
  try {
    await chrome.debugger.sendCommand(debuggee,'Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x,y:target.y,button:'none',buttons:0,clickCount:0,pointerType:'mouse'});
    await delay(120);
    const refreshed=await sendToTab(tabId,{type:'FSM_MM_RECHECK_OUTBOUND_FARE',runId:state.runId},2500).catch(error=>({ok:false,reason:String(error)}));
    if(!refreshed?.ok || !refreshed.target) throw new Error(`M&M could not refresh the outbound fare target after hover: ${refreshed?.reason || 'no target returned'}`);
    target=refreshed.target;
    await chrome.debugger.sendCommand(debuggee,'Input.dispatchMouseEvent',{type:'mousePressed',x:target.x,y:target.y,button:'left',buttons:1,clickCount:1,pointerType:'mouse'});
    const interrupted=control();
    await chrome.debugger.sendCommand(debuggee,'Input.dispatchMouseEvent',{type:'mouseReleased',x:interrupted?-1:target.x,y:interrupted?-1:target.y,button:'left',buttons:0,clickCount:1,pointerType:'mouse'});
    if(interrupted) return {control:interrupted};
    recordActivity('OUTBOUND_FARE_CLICKED','Chrome opened the requested outbound fare family.','WAITING_FOR_RESULTS');
    return {ok:true};
  } finally { await chrome.debugger.detach(debuggee).catch(()=>{}); }
}

async function clickMilesExpandedFareSelectWithNativeInput(tabId, target) {
  const control=()=>state.stopRequested?'CANCELLED':state.paused?'PAUSED':null;
  const debuggee={tabId};
  await chrome.debugger.attach(debuggee,'1.3');
  try {
    await chrome.debugger.sendCommand(debuggee,'Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x,y:target.y,button:'none',buttons:0,clickCount:0,pointerType:'mouse'});
    await delay(120);
    const refreshed=await sendToTab(tabId,{type:'FSM_MM_RECHECK_EXPANDED_FARE_SELECT',runId:state.runId},2500).catch(error=>({ok:false,reason:String(error)}));
    if(!refreshed?.ok || !refreshed.target) throw new Error(`M&M could not refresh the expanded fare selection after hover: ${refreshed?.reason || 'no target returned'}`);
    target=refreshed.target;
    await chrome.debugger.sendCommand(debuggee,'Input.dispatchMouseEvent',{type:'mousePressed',x:target.x,y:target.y,button:'left',buttons:1,clickCount:1,pointerType:'mouse'});
    const interrupted=control();
    await chrome.debugger.sendCommand(debuggee,'Input.dispatchMouseEvent',{type:'mouseReleased',x:interrupted?-1:target.x,y:interrupted?-1:target.y,button:'left',buttons:0,clickCount:1,pointerType:'mouse'});
    if(interrupted) return {control:interrupted};
    recordActivity('OUTBOUND_FARE_SELECTED','Chrome selected the outbound fare. Waiting for return selection.','WAITING_FOR_RESULTS');
    return {ok:true};
  } finally { await chrome.debugger.detach(debuggee).catch(()=>{}); }
}

async function waitForMilesFormReady(tabId, runId, timeoutMs=20000) {
  const deadline=Date.now()+timeoutMs;
  let injected=false;
  let lastMissing=['booking form'];
  let lastError='';
  recordActivity('M_AND_M_HANDSHAKE','M&M tab opened. Waiting for the booking form and page connection.','STARTING');
  while(Date.now()<deadline) {
    if (state.stopRequested) return {control:'CANCELLED'};
    if (state.paused) return {control:'PAUSED'};
    try {
      const ready=await sendToTab(tabId,{type:'FSM_MM_READY',runId},2500);
      if (ready?.ready) {
        recordActivity('M_AND_M_CONNECTED','M&M booking form and page connection confirmed.','STARTING');
        return ready;
      }
      if (Array.isArray(ready?.missing) && ready.missing.length) lastMissing=ready.missing;
      lastError='';
      if (!injected) {
        injected=true;
        recordActivity('M_AND_M_ADAPTER_REFRESH','Booking controls are still loading. Refreshing the page connection.','STARTING');
        await chrome.scripting.executeScript({target:{tabId},files:['src/content/miles-and-more.js']}).catch(error=>{ lastError=String(error); });
      }
    } catch (error) {
      lastError=String(error);
      if (!injected) {
        injected=true;
        recordActivity('M_AND_M_ADAPTER_REFRESH','Connecting the M&M page assistant.','STARTING');
        await chrome.scripting.executeScript({target:{tabId},files:['src/content/miles-and-more.js']}).catch(injectionError=>{ lastError=String(injectionError); });
      }
    }
    await delay(400);
  }
  return {ready:false,missing:lastMissing,connectionError:lastError};
}

async function waitForMilesResultAdapter(tabId, runId, query, timeoutMs) {
  const deadline=Date.now()+Math.max(5000,timeoutMs);
  let injected=false;
  let lastError='';
  while(Date.now()<deadline) {
    if(state.stopRequested) return {state:'CANCELLED'};
    if(state.paused) return {state:'PAUSED'};
    try {
      const immediate=await sendToTab(tabId,{type:'FSM_PARSE_RESULTS',query:{cabin:query.cabin}},2500);
      if(immediate?.parsed?.status && immediate.parsed.status!=='INCONCLUSIVE') return immediate;
      return await sendToTab(tabId,{type:'FSM_WAIT_FOR_RESULTS',runId,query:{cabin:query.cabin},timeoutMs:Math.max(5000,deadline-Date.now())},Math.max(7000,deadline-Date.now()+3000));
    } catch(error) {
      lastError=String(error);
      if(!injected) {
        injected=true;
        recordActivity('M_AND_M_RESULT_ADAPTER_REFRESH','Connecting the M&M result-page assistant.','WAITING_FOR_RESULTS');
        await chrome.scripting.executeScript({target:{tabId},files:['src/content/miles-and-more.js']}).catch(injectionError=>{ lastError=String(injectionError); });
      }
      await delay(300);
    }
  }
  return {state:'PARSED',parsed:{status:STATUS.INCONCLUSIVE,statusDetail:`M&M result-page assistant did not respond: ${lastError || 'timed out'}.`}};
}

async function waitForMilesResultNavigation(tabId, beforeUrl, timeoutMs, query, preparedSearch=null) {
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline) {
    if (state.stopRequested) return {control:'CANCELLED'};
    if (state.paused) return {control:'PAUSED'};
    const tab=await chrome.tabs.get(tabId).catch(()=>null);
    if (!tab) return {parsed:{status:STATUS.INCONCLUSIVE,statusDetail:'The dedicated M&M test tab was closed.'},sourceUrl:''};
    let resultSurface=!!(tab.url && tab.url !== beforeUrl);
    if (!resultSurface && tab.status === 'complete') {
      const page=await sendToTab(tabId,{type:'FSM_PARSE_RESULTS',query:{cabin:query.cabin}},2500).catch(()=>null);
      resultSurface=['AVAILABLE','NO_RESULT'].includes(page?.parsed?.status);
      if(resultSurface) recordActivity('RESULT_SURFACE','M&M result page detected without a URL change.');
    }
    if (resultSurface) {
      setPhase('WAITING_FOR_RESULTS','M&M result page detected. Waiting for result parsing.');
      if (tab.url && tab.url !== beforeUrl) recordActivity('RESULT_NAVIGATION','M&M navigation detected.');
      if (tab.status !== 'complete') await waitForTabComplete(tabId, Math.max(3000,deadline-Date.now())).catch(()=>{});
      let submitted={search:preparedSearch};
      const submissionDeadline=Math.min(deadline,Date.now()+3000);
      while(!submitted?.search && Date.now()<submissionDeadline) {
        if(state.stopRequested) return {control:'CANCELLED'};
        if(state.paused) return {control:'PAUSED'};
        submitted=await sendToTab(tabId,{type:'FSM_MM_SUBMITTED_SEARCH'},2500).catch(()=>null);
        await delay(300);
      }
      if(validateSubmittedDates(submitted?.search,query)) recordActivity('SUBMITTED_DATES_VERIFIED','M&M received the requested travel dates.','WAITING_FOR_RESULTS');
      else recordActivity('SUBMITTED_DATES_COMMITTED','M&M committed the requested form dates before the click; no result-page submission payload was available.','WAITING_FOR_RESULTS');
      const response=await waitForMilesResultAdapter(tabId,state.runId,query,Math.max(5000,deadline-Date.now()));
      if (response?.state === 'CANCELLED' || response?.state === 'PAUSED') return {control:response.state};
      const fresh=await chrome.tabs.get(tabId).catch(()=>tab);
      return {parsed:response?.parsed || {status:STATUS.INCONCLUSIVE,statusDetail:'No result parser response.'},sourceUrl:fresh.url || '',browserGate:{formControlsVerified:true,formActionsVerified:true,searchSubmittedOnce:true,resultNavigationVerified:true}};
    }
    await delay(250);
  }
  const tab=await chrome.tabs.get(tabId).catch(()=>null);
  return {parsed:{status:STATUS.INCONCLUSIVE,statusDetail:'Search flights was activated once, but no result-page navigation was seen.'},sourceUrl:tab?.url || beforeUrl};
}

async function recordLiveBrowserGate(query, outcome) {
  if (query.adapter !== 'miles-and-more' || !outcome.browserGate) return;
  const proof={
    schema_version:2,
    provider:'miles-and-more',
    extension_version:chrome.runtime.getManifest().version,
    verified_at:new Date().toISOString(),
    form_controls_verified:outcome.browserGate.formControlsVerified === true,
    form_actions_verified:outcome.browserGate.formActionsVerified === true,
    search_submitted_once:outcome.browserGate.searchSubmittedOnce === true,
    result_navigation_verified:outcome.browserGate.resultNavigationVerified === true,
    result_status:outcome.parsed?.status || STATUS.INCONCLUSIVE,
    source_url:outcome.sourceUrl || ''
  };
  await chrome.storage.local.set({[LIVE_BROWSER_GATE_KEY]:proof});
  broadcast({type:'BROWSER_GATE_READY',proof});
}

async function executeMilesAndMoreQuery(tab, query, settings) {
  if (query.tripType === 'openjaw') return { parsed:{ status:STATUS.NEEDS_USER, statusDetail:'Open-jaw automation requires live Miles & More calibration. Use manual capture for now.' }, sourceUrl:tab?.url || '' };
  if (query.tripType !== 'roundtrip') return { parsed:{ status:STATUS.NEEDS_USER, statusDetail:'Miles & More fare-combination calibration is round-trip only. Choose Round trip so both outbound and return dates are entered.' }, sourceUrl:tab?.url || '' };
  const searchUrl = settings.mmSearchPageUrl || DEFAULT_SETTINGS.mmSearchPageUrl;
  try {
    // Every attempt starts from the actual Award Flight booking form. A prior attempt may have left this tab on the shop.miles-and-more.com results SPA.
    if (!tab?.id) throw new Error('Miles & More automation tab is missing.');
    tab=await chrome.tabs.get(tab.id);
    setPhase('STARTING','Opening the dedicated Miles & More test tab.');
    recordActivity('OPENING_M_AND_M','Opening the dedicated Miles & More test tab.');
    if (tab.status !== 'complete') await waitForTabComplete(tab.id);
    tab=await chrome.tabs.get(tab.id);
    if ((tab.url || '') !== searchUrl) {
      await chrome.tabs.update(tab.id,{url:searchUrl,active:true});
      await waitForTabComplete(tab.id);
    }
    const beforeSubmit=(await chrome.tabs.get(tab.id)).url || searchUrl;
    const ready=await waitForMilesFormReady(tab.id,state.runId,20000);
    if (ready?.control) return {control:ready.control};
    if (!ready?.ready) {
      const detail=(ready?.missing || []).join(', ') || 'no page-adapter response';
      const connection=ready?.connectionError ? ` Connection detail: ${ready.connectionError}` : '';
      return {parsed:{status:STATUS.NEEDS_USER,statusDetail:`M&M booking form did not become ready within 20 seconds: ${detail}.${connection}`},sourceUrl:beforeSubmit};
    }
    setPhase('ACTIVE','M&M confirmed that its booking form is ready.');
    recordActivity('FORM_READY','M&M confirmed that its booking form is ready.');
    const response = await sendToTab(tab.id,{type:'FSM_RUN_QUERY',runId:state.runId,query},35000);
    if (response?.state === 'CANCELLED' || response?.state === 'PAUSED') return {control:response.state};
    if (response?.state === 'READY_FOR_NATIVE_CLICK') {
      if(response.submittedSearch && !validateSubmittedDates(response.submittedSearch,query)) {
        const detail='Miles & More prepared a submission with missing or incorrect travel dates. Search flights was not clicked.';
        recordActivity('SUBMITTED_DATES_REJECTED',detail,'NEEDS_USER');
        return {parsed:{status:STATUS.NEEDS_USER,statusDetail:detail},sourceUrl:beforeSubmit};
      }
      if(validateSubmittedDates(response.submittedSearch,query)) recordActivity('SUBMITTED_DATES_PREPARED','M&M prepared the requested travel dates for native submission.','WAITING_FOR_RESULTS');
      else recordActivity('SUBMITTED_DATES_COMMITTED','M&M committed the requested form dates; the optional submission payload was not yet available.','WAITING_FOR_RESULTS');
      setPhase('WAITING_FOR_RESULTS','Sending one native Search flights click.');
      recordActivity('SEARCH_FLIGHTS_NATIVE_CLICK','Sending one native Search flights click.','WAITING_FOR_RESULTS');
      try {
        const click=await clickMilesSearchWithNativeInput(tab.id,response.target);
        if(click?.control) return click;
      }
      catch (error) {
        return {parsed:{status:STATUS.NEEDS_USER,statusDetail:`Chrome could not send the native Search flights click: ${String(error)}`},sourceUrl:beforeSubmit};
      }
      await delay(700);
      const afterClick=await chrome.tabs.get(tab.id).catch(()=>null);
      if (!afterClick) return {parsed:{status:STATUS.INCONCLUSIVE,statusDetail:'The dedicated M&M test tab was closed after Search flights was clicked.'},sourceUrl:''};
      if (afterClick.url === beforeSubmit) {
        const acknowledged=await sendToTab(tab.id,{type:'FSM_MM_CONFIRM_NATIVE_SEARCH_CLICK',runId:state.runId},4000).catch(error=>({ok:false,reason:String(error)}));
        const trace=(acknowledged?.trace || []).map(event=>`${event.type}${event.trusted?' (trusted)':' (synthetic)'} on ${event.target}`).join(', ') || 'no page events observed';
        recordActivity('NATIVE_CLICK_TRACE',`Native click trace: ${trace}.`,'WAITING_FOR_RESULTS');
        if (!acknowledged?.ok) return {parsed:{status:STATUS.NEEDS_USER,statusDetail:`${acknowledged?.reason || 'Miles & More did not acknowledge the native Search flights click.'} Native click trace: ${trace}.`},sourceUrl:afterClick.url};
      }
      const waitMs=Math.max(15,Number(settings.resultWaitSeconds || 35))*1000;
      setPhase('WAITING_FOR_RESULTS','M&M accepted the native Search flights click. Waiting for result navigation.');
      recordActivity('WAITING_FOR_RESULTS','M&M accepted the native Search flights click. Waiting for result navigation.','WAITING_FOR_RESULTS');
      const outcome=await waitForMilesResultNavigation(tab.id,beforeSubmit,waitMs,query,response.submittedSearch);
      if(outcome?.parsed?.status!=='AVAILABLE') return outcome;
      const fare=await sendToTab(tab.id,{type:'FSM_MM_PREPARE_OUTBOUND_FARE',runId:state.runId,cabin:query.cabin},4000).catch(error=>({ok:false,reason:String(error)}));
      if(!fare?.ok) return {...outcome,parsed:{...outcome.parsed,status:'NEEDS_USER',statusDetail:`Outbound results were saved, but FSM could not open the requested fare family: ${fare?.reason || 'no control returned'}`}};
      setPhase('WAITING_FOR_RESULTS','Opening the requested outbound fare family.');
      await clickMilesOutboundFareWithNativeInput(tab.id,fare.target);
      await delay(800);
      const expanded=await sendToTab(tab.id,{type:'FSM_MM_OUTBOUND_FARE_STATE'},3000).catch(()=>({open:false}));
      if(!expanded?.open) return {...outcome,parsed:{...outcome.parsed,status:'NEEDS_USER',statusDetail:'Outbound results were saved, but Miles & More did not reveal fare-family choices after the native click.'}};
      recordActivity('OUTBOUND_FARE_FAMILIES_OPEN','Outbound fare-family choices are open. Selecting the visible compatible fare.','WAITING_FOR_RESULTS');
      const select=await sendToTab(tab.id,{type:'FSM_MM_PREPARE_EXPANDED_FARE_SELECT',runId:state.runId},4000).catch(error=>({ok:false,reason:String(error)}));
      if(!select?.ok) return {...outcome,parsed:{...outcome.parsed,status:'NEEDS_USER',statusDetail:`Outbound fare-family choices are open, but FSM could not prepare the fare selection: ${select?.reason || 'no control returned'}`}};
      const beforeFareSelection=(await chrome.tabs.get(tab.id)).url || '';
      await clickMilesExpandedFareSelectWithNativeInput(tab.id,select.target);
      const returnWaitMs=Math.max(15,Number(settings.resultWaitSeconds || 35))*1000;
      return waitForMilesResultNavigation(tab.id,beforeFareSelection,returnWaitMs,query,null);
    }
    const freshTab = await chrome.tabs.get(tab.id);
    return { parsed:response?.parsed || response || {status:STATUS.INCONCLUSIVE,statusDetail:'No adapter response'}, sourceUrl:freshTab.url };
  } catch (error) {
    const freshTab = await chrome.tabs.get(tab?.id).catch(()=>tab);
    return { parsed:{status:STATUS.INCONCLUSIVE,statusDetail:String(error),rawExcerpt:''}, sourceUrl:freshTab?.url || '' };
  }
}

async function executeLhgCashQuery(tab, query, settings) {
  const config = providerConfig(query.adapter, settings);
  if (!config) return { parsed:{status:STATUS.NEEDS_USER,statusDetail:`Adapter ${query.adapter} has no provider configuration.`}, sourceUrl:'' };
  if (!(tab?.url || '').includes(query.adapter === 'lufthansa-cash' ? 'lufthansa.com' : 'brusselsairlines.com')) {
    await chrome.tabs.update(tab.id,{url:config.url,active:true}); await waitForTabComplete(tab.id); await delay(1200);
  }
  try {
    let response = await sendToTab(tab.id,{type:config.runType,query},25000);
    if (response?.state === 'SUBMITTED') {
      const waitMs = Math.max(10, Number(settings.resultWaitSeconds || 35)) * 1000;
      response = await sendToTab(tab.id,{type:config.waitType,query,timeoutMs:waitMs},waitMs + 5000);
    }
    const freshTab = await chrome.tabs.get(tab.id);
    return { parsed:response?.parsed || response || {status:STATUS.INCONCLUSIVE,statusDetail:'No Lufthansa Group adapter response'}, sourceUrl:freshTab.url };
  } catch (error) {
    const freshTab = await chrome.tabs.get(tab.id).catch(()=>tab);
    return { parsed:{status:STATUS.INCONCLUSIVE,statusDetail:String(error),rawExcerpt:''}, sourceUrl:freshTab?.url || '' };
  }
}

async function maybeNotify(settings, title, message) {
  if (!settings.notificationsEnabled) return;
  const allowed = await chrome.permissions.contains({permissions:['notifications']}).catch(()=>false);
  if (!allowed) return;
  await chrome.notifications.create({type:'basic',iconUrl:chrome.runtime.getURL('icon128.png'),title,message}).catch(()=>{});
}

async function resumePersistedRun() {
  const { activeRun } = await chrome.storage.local.get(ACTIVE_RUN_KEY);
  if (!activeRun || activeRun.finished) throw new Error('No interrupted run is available to resume.');
  return runMatrix(activeRun.tasks, activeRun.settings, { runId:activeRun.runId, startIndex:activeRun.nextIndex || 0, startedAt:activeRun.startedAt, searchDefinition:activeRun.searchDefinition || {}, mode:activeRun.mode || 'matrix', resumed:true });
}

async function runMatrix(tasks, incomingSettings={}, resume={}) {
  if (state.running) throw new Error('A search run is already active.');
  const mode=resume.mode || 'matrix';
  if (mode === 'guided-mm-test' && (tasks.length !== 1 || tasks[0]?.adapter !== 'miles-and-more')) throw new Error('The Miles & More guided test accepts exactly one Miles & More query.');
  if (mode === 'matrix' && tasks.some(task => task.adapter === 'miles-and-more')) throw new Error('Miles & More matrix runs remain disabled while round-trip fare-combination calibration is in progress. Use Test M&M form.');
  const settings = {...DEFAULT_SETTINGS,...incomingSettings};
  const runId = resume.runId || crypto.randomUUID();
  const startIndex = Math.max(0, Number(resume.startIndex || 0));
  const startedAt = resume.startedAt || new Date().toISOString();
  Object.assign(state,{running:true,paused:false,stopRequested:false,recoverable:false,runId,completed:startIndex,total:tasks.length,phase:'STARTING',detail:'Run request accepted. Preparing the first page action.',activity:[],automationTabId:null,mode,needsUser:false,needsUserDetail:''});
  await saveRun({schema_version:SCHEMA_VERSION,run_id:runId,started_at:startedAt,status:resume.resumed?'RESUMED':'RUNNING',total_queries:tasks.length,completed_queries:startIndex,search_definition_json:resume.searchDefinition || incomingSettings.searchDefinition || {},settings_snapshot_json:settings});
  await persistRun({runId,tasks,settings,searchDefinition:resume.searchDefinition || incomingSettings.searchDefinition || {},nextIndex:startIndex,finished:false,status:'RUNNING',phase:'STARTING',detail:state.detail,mode:state.mode,startedAt,updatedAt:new Date().toISOString()});
  broadcast({type:'RUN_STARTED',runId,total:tasks.length,resumed:!!resume.resumed,startIndex});
  setPhase('STARTING',state.detail); recordActivity('RUN_ACCEPTED',state.detail,'STARTING');

  let tab = null;
  let runError = null;
  let inconclusiveQueries = 0;
  try {
    for (let index=startIndex; index<tasks.length; index++) {
      if (state.stopRequested) break;
      await waitWhilePaused(); if (state.stopRequested) break;
      const query = tasks[index];
      const retries = Math.max(1,Number(settings.retriesPerQuery || 3));
      const queryObservations = [];
      let sawAvailable = false, completedNoResultAttempts = 0, failureStreak = 0;
      if (providerConfig(query.adapter, settings)) { tab = await getOrCreateAutomationTab(query.adapter, settings); state.automationTabId=tab?.id || null; }

      for (let attempt=1; attempt<=retries; attempt++) {
        if (state.stopRequested) break;
        await waitWhilePaused();
      setPhase('ACTIVE','Starting query '+(index+1)+' of '+tasks.length+', attempt '+attempt+' of '+retries+': '+query.origin+' to '+query.destination+'.');
      broadcast({type:'QUERY_PROGRESS',index:index+1,total:tasks.length,query,attempt,retries});
        let outcome;
        if (query.adapter === 'miles-and-more') outcome = await executeMilesAndMoreQuery(tab,query,settings);
        else if (query.adapter === 'lufthansa-cash' || query.adapter === 'brussels-airlines-cash') outcome = await executeLhgCashQuery(tab,query,settings);
        else outcome = {parsed:{status:STATUS.NEEDS_USER,statusDetail:`Adapter ${query.adapter} is not automated yet.`},sourceUrl:tab?.url || ''};
        if (outcome.control === 'CANCELLED') break;
        if (outcome.control === 'PAUSED') { setPhase('PAUSED','M&M paused at a safe boundary.'); recordActivity('PAUSED','M&M paused at a safe boundary.','PAUSED'); await waitWhilePaused(); attempt--; continue; }
        await recordLiveBrowserGate(query,outcome);
        if (outcome.parsed.status === STATUS.NO_RESULT) completedNoResultAttempts++;
        if (outcome.parsed.status === STATUS.AVAILABLE) sawAvailable = true;
        const parsedCandidates=outcome.parsed.status===STATUS.AVAILABLE && Array.isArray(outcome.parsed.observationCandidates) && outcome.parsed.observationCandidates.length
          ? outcome.parsed.observationCandidates.map(candidate=>({...outcome.parsed,...candidate,observationCandidates:undefined,rawExcerpt:outcome.parsed.rawExcerpt,statusDetail:outcome.parsed.statusDetail}))
          : [outcome.parsed];
        for(const parsed of parsedCandidates) {
          const observation = makeObservation({runId,query,attempt,parsed,sourceUrl:outcome.sourceUrl});
          queryObservations.push(observation); await saveResult(observation); broadcast({type:'RESULT_SAVED',result:observation});
        }
        if (outcome.parsed.status === STATUS.AVAILABLE) await maybeNotify(settings,'Flight Search Matrix','Availability found. Open the extension for details.');
        if (outcome.parsed.status === STATUS.NEEDS_USER) await maybeNotify(settings,'Flight Search Matrix','A search needs your attention.');
        if (sawAvailable || outcome.parsed.status === STATUS.NEEDS_USER) {
          if (outcome.parsed.status === STATUS.NEEDS_USER) {
            state.needsUser=true;
            state.needsUserDetail=outcome.parsed.statusDetail || 'M&M needs your attention before the search can continue.';
            setPhase('NEEDS_USER',state.needsUserDetail);
          }
          break;
        }
        failureStreak = [STATUS.ERROR, STATUS.INCONCLUSIVE].includes(outcome.parsed.status) ? failureStreak + 1 : 0;
        if (attempt < retries) await delay(providerDelay(settings, query.adapter, failureStreak));
      }
      if (!sawAvailable && completedNoResultAttempts === retries) {
        const summaryObservation = makeObservation({runId,query,attempt:retries,parsed:{status:STATUS.NO_RESULT_REPEATED,statusDetail:`No result after ${retries} completed searches.`},sourceUrl:tab?.url || ''});
        queryObservations.push(summaryObservation); await saveResult(summaryObservation); broadcast({type:'RESULT_SAVED',result:summaryObservation});
      }
      const querySummary = summarizeQuery({runId,query,observations:queryObservations});
      if(!sawAvailable && completedNoResultAttempts!==retries && !state.needsUser && !state.stopRequested) inconclusiveQueries++;
      await saveSummary(querySummary);
      if (sawAvailable && settings.searchDefinition?.smartOrder !== false) reprioritizeAdjacent(tasks,index,query); broadcast({type:'SUMMARY_SAVED',summary:querySummary});
      if (state.stopRequested) break;
      state.completed = index + 1;
      setPhase('ACTIVE','Completed '+state.completed+' of '+state.total+' queries.');
      await persistRun({runId,tasks,settings,searchDefinition:resume.searchDefinition || incomingSettings.searchDefinition || {},nextIndex:index+1,startedAt,finished:false,status:'RUNNING',updatedAt:new Date().toISOString()});
      broadcast({type:'RUN_PROGRESS',completed:state.completed,total:state.total});
      if (settings.stopOnFirstAvailable && sawAvailable) { state.stopRequested = true; break; }
      if (index < tasks.length-1) await delay(providerDelay(settings, query.adapter, 0));
    }
  } catch (error) {
    runError = error;
    setPhase('ERROR',String(error));
    broadcast({type:'RUN_ERROR',error:String(error)});
  } finally {
    const status = runError ? 'ERROR' : (state.stopRequested ? 'STOPPED' : (state.needsUser ? 'NEEDS_USER' : (inconclusiveQueries ? 'INCONCLUSIVE' : 'COMPLETE')));
    await saveRun({schema_version:SCHEMA_VERSION,run_id:runId,started_at:startedAt,ended_at:new Date().toISOString(),status,total_queries:tasks.length,completed_queries:state.completed,search_definition_json:resume.searchDefinition || incomingSettings.searchDefinition || {},settings_snapshot_json:settings});
    await clearRunPersistence(status);
    const finalDetail=status==='ERROR' ? 'Run error: '+String(runError) : (status==='NEEDS_USER' ? state.needsUserDetail || 'The guided M&M test needs your attention before search submission.' : status==='INCONCLUSIVE' ? `Run inconclusive - ${inconclusiveQueries} queries ended without confirmed availability or a completed no-result outcome.` : `Run ${status.toLowerCase()} - ${state.completed}/${state.total} queries.`);
    Object.assign(state,{running:false,paused:false,recoverable:false,automationTabId:null,phase:status==='ERROR'?'ERROR':(status==='COMPLETE'?'COMPLETED':status),detail:finalDetail});
    broadcast({type:'RUN_FINISHED',runId,status,detail:finalDetail,completed:state.completed,total:state.total});
    await maybeNotify(settings,'Flight Search Matrix',`Run ${status.toLowerCase()}: ${state.completed}/${state.total} queries.`);
  }
}
