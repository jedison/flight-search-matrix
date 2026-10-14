import { buildSearchMatrix, matrixSummary } from './src/matrix.js';
import { DEFAULT_SETTINGS } from './src/constants.js';
import { getResults, getSummaries, getRuns, getCurrentBest, getResultsForQuery, getUnsyncedResults, getUnsyncedSummaries, markSynced, markSyncError, markSummariesSynced, markSummariesSyncError, saveResult } from './src/db.js';
import { syncResultsToSheets, syncSummariesToSheets, syncRunsToSheets, syncCurrentBestToSheets } from './src/sheets-sync.js';
import { resultsToCsv } from './src/csv.js';
import { makeObservation } from './src/result.js';
import { historyDetailHtml } from './src/history-detail.js';

let matrix = [];
let activity = [];
const $ = id => document.getElementById(id);
const EXTENSION_VERSION = '0.8.12';
function setRunState(phase, detail) {
  const root=$('runState'); if (!root) return;
  const normalized=String(phase||'IDLE').toLowerCase();
  root.className=`run-state ${normalized}`;
  $('runStateLabel').textContent=String(phase||'IDLE');
  $('runStateDetail').textContent=detail || '';
  $('runStatus').textContent=detail || String(phase||'IDLE');
  updateRunControls(phase);
}
function updateRunControls(phase='IDLE') {
  const active=['STARTING','RUNNING','ACTIVE','WAITING_FOR_USER','WAITING_FOR_RESULTS','PAUSING','STOPPING','PAUSED'].includes(String(phase));
  $('testMilesAndMore').disabled=active;
  $('start').disabled=active || $('adapter').value==='miles-and-more';
  $('pause').disabled=!active || ['PAUSED','PAUSING','STOPPING'].includes(String(phase));
  $('resume').disabled=!['PAUSED','PAUSING'].includes(String(phase));
  $('stop').disabled=!active || String(phase)==='STOPPING';
}

function showActivity(events) {
  activity=events || [];
  const timeline=$('runTimeline');
  if (!timeline) return;
  timeline.innerHTML=activity.length ? activity.slice().reverse().map(event=>{
    const time=escapeHtml(String(event.at||'').slice(11,19));
    return `<li><time>${time}</time>${escapeHtml(event.detail || event.step || 'Activity confirmed.')}</li>`;
  }).join('') : '<li>Waiting for a run.</li>';
}

function selectedCabins() { return [...document.querySelectorAll('input[name="cabin"]:checked')].map(x => x.value); }
function customAirportGroups() { const raw=$('airportGroups')?.value?.trim(); if (!raw) return {}; try { const parsed=JSON.parse(raw); return parsed && typeof parsed==='object' ? parsed : {}; } catch { return {}; } }
function formInput() {
  return { adapter:$('adapter').value, origins:$('origins').value, destinations:$('destinations').value, tripType:$('tripType').value,
    returnOrigins:$('returnOrigins').value, returnDestinations:$('returnDestinations').value,
    outboundStart:$('outboundStart').value, outboundEnd:$('outboundEnd').value, returnStart:$('returnStart').value, returnEnd:$('returnEnd').value,
    minNights:$('minNights').value, maxNights:$('maxNights').value, adults:$('adults').value, cabins:selectedCabins(), smartOrder:$('smartOrder').checked, airportGroups:customAirportGroups(),
    constraints:{ maxStops:$('maxStops').value, maxLayoverMinutes:$('maxLayoverMinutes').value, allowedConnectionAirports:$('allowedConnectionAirports').value,
      blockedConnectionAirports:$('blockedConnectionAirports').value, allowedCarriers:$('allowedCarriers').value, blockedCarriers:$('blockedCarriers').value,
      requireRequestedCabin:$('requireRequestedCabin').checked } };
}
// Toolbar popups are destroyed when dismissed. Keep the unfinished plan locally.
let draftWrites=Promise.resolve();
function savePlanDraft() {
  const plan=formInput();
  const draft={plan,airportGroupsText:$('airportGroups').value,profile:$('profileSelect').value};
  draftWrites=draftWrites.catch(()=>{}).then(()=>chrome.storage.local.set({popupPlanDraft:draft}));
  return draftWrites;
}
async function restorePlanDraft() {
  const {popupPlanDraft:draft}=await chrome.storage.local.get('popupPlanDraft');
  if(draft?.plan) {
    applyProfile(draft.plan,false);
    $('airportGroups').value=draft.airportGroupsText ?? $('airportGroups').value;
    $('profileSelect').value=draft.profile || '';
  }
}
function settingsFromForm() {
  return { retriesPerQuery:Number($('retriesPerQuery').value || 3), minDelaySeconds:Number($('minDelaySeconds').value || 8),
    maxDelaySeconds:Number($('maxDelaySeconds').value || 16), maxBackoffSeconds:Number($('maxBackoffSeconds').value || 120), resultWaitSeconds:Number($('resultWaitSeconds').value || 35),
    stopOnFirstAvailable:$('stopOnFirstAvailable').checked, notificationsEnabled:$('notificationsEnabled').checked, mmPinnedOverlay:$('mmPinnedOverlay').checked, sheetsWebAppUrl:$('sheetsWebAppUrl').value.trim(), sheetsToken:$('sheetsToken').value, autoSync:$('autoSync').checked };
}
async function loadSettings() {
  const stored = await chrome.storage.local.get('settings');
  const s = {...DEFAULT_SETTINGS,...(stored.settings || {})};
  $('retriesPerQuery').value=s.retriesPerQuery; $('minDelaySeconds').value=s.minDelaySeconds; $('maxDelaySeconds').value=s.maxDelaySeconds;
  $('resultWaitSeconds').value=s.resultWaitSeconds; $('maxBackoffSeconds').value=s.maxBackoffSeconds || 120; $('stopOnFirstAvailable').checked=!!s.stopOnFirstAvailable; $('notificationsEnabled').checked=!!s.notificationsEnabled; $('mmPinnedOverlay').checked=!!s.mmPinnedOverlay; $('sheetsWebAppUrl').value=s.sheetsWebAppUrl || ''; $('sheetsToken').value=s.sheetsToken || ''; $('autoSync').checked=!!s.autoSync;
  return s;
}
async function saveSettings() {
  const old=(await chrome.storage.local.get('settings')).settings || {};
  const requested=settingsFromForm();
  if (requested.notificationsEnabled) {
    const allowed=await chrome.permissions.contains({permissions:['notifications']});
    if (!allowed) requested.notificationsEnabled=await chrome.permissions.request({permissions:['notifications']});
    $('notificationsEnabled').checked=!!requested.notificationsEnabled;
  }
  const settings={...DEFAULT_SETTINGS,...old,...requested}; await chrome.storage.local.set({settings}); $('syncStatus').textContent='Settings saved.'; return settings;
}

function applyProfile(profile, persistDraft=true) {
  if (!profile) return;
  const fields=['adapter','origins','destinations','tripType','returnOrigins','returnDestinations','outboundStart','outboundEnd','returnStart','returnEnd','minNights','maxNights','adults'];
  fields.forEach(key => { if (profile[key] !== undefined && $(key)) $(key).value=profile[key]; });
  document.querySelectorAll('input[name="cabin"]').forEach(cb => { cb.checked=(profile.cabins || []).includes(cb.value); });
  $('smartOrder').checked=profile.smartOrder !== false; $('airportGroups').value=profile.airportGroups && Object.keys(profile.airportGroups).length ? JSON.stringify(profile.airportGroups,null,2) : '';
  const c=profile.constraints || {}; ['maxStops','maxLayoverMinutes','allowedConnectionAirports','blockedConnectionAirports','allowedCarriers','blockedCarriers'].forEach(k=>{ if($(k)) $(k).value=c[k] ?? ''; });
  $('requireRequestedCabin').checked=!!c.requireRequestedCabin; updateTripTypeFields(); rebuildMatrix();
  if(persistDraft) savePlanDraft().catch(()=>{});
}
async function loadProfiles(selected='') {
  const stored=await chrome.storage.local.get('profiles'); const profiles=stored.profiles || {};
  $('profileSelect').innerHTML='<option value="">Current / unsaved</option>'+Object.keys(profiles).sort().map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  if (selected && profiles[selected]) { $('profileSelect').value=selected; applyProfile(profiles[selected]); }
  return profiles;
}
async function saveProfile() {
  const name=prompt('Profile name'); if (!name?.trim()) return;
  const stored=await chrome.storage.local.get('profiles'); const profiles={...(stored.profiles || {}),[name.trim()]:formInput()};
  await chrome.storage.local.set({profiles}); await loadProfiles(name.trim()); $('matrixInfo').textContent=`Profile "${name.trim()}" saved.`;
}
async function deleteProfile() {
  const name=$('profileSelect').value; if (!name) return;
  const stored=await chrome.storage.local.get('profiles'); const profiles={...(stored.profiles || {})}; delete profiles[name]; await chrome.storage.local.set({profiles}); await loadProfiles();
}

function matrixPreviewText(tasks, limit=24) {
  if (!tasks.length) return 'No generated queries.';
  const lines=tasks.slice(0,limit).map((q,i)=>`${i+1}. ${q.origin} -> ${q.destination}${q.returnDate?` / ${q.returnOrigin || q.destination} -> ${q.returnDestination || q.origin}`:''} | ${q.outboundDate}${q.returnDate?` - ${q.returnDate}`:''} | ${q.cabin}`);
  if(tasks.length>limit) lines.push(`... ${tasks.length-limit} more quer${tasks.length-limit===1?'y':'ies'}`);
  return lines.join('\n');
}
function rebuildMatrix() {
  const input=formInput(); matrix=buildSearchMatrix(input); const retries=Number($('retriesPerQuery').value || 3); const s=matrixSummary(matrix,retries);
  $('matrixInfo').textContent=`${s.queries} queries - up to ${s.maximum_attempts} attempts - ${s.origins} origin(s), ${s.destinations} destination(s), ${s.cabins} cabin(s).`;
  if($('matrixPreview')) $('matrixPreview').textContent=matrixPreviewText(matrix);
  return matrix;
}
async function startRun() {
  await savePlanDraft();
  rebuildMatrix(); if (!matrix.length) { $('runStatus').textContent='Matrix is empty. Check cities, dates and cabins.'; return; }
  if ($('adapter').value==='miles-and-more') { $('runStatus').textContent='Miles & More matrix runs are paused while round-trip fare-combination calibration is in progress. Use Test M&M form.'; return; }
  if (matrix.length>1500 && !confirm(`This matrix has ${matrix.length} queries. Continue?`)) return;
  const settings=await saveSettings(); settings.searchDefinition=formInput(); const reply=await chrome.runtime.sendMessage({type:'RUN_MATRIX',tasks:matrix,settings});
  if (reply?.error) $('runStatus').textContent=reply.error;
}
async function testMilesAndMore() {
  await savePlanDraft();
  rebuildMatrix();
  if (!matrix.length) { $('runStatus').textContent='Matrix is empty. Check cities, dates and cabins.'; return; }
  if ($('adapter').value!=='miles-and-more') { $('runStatus').textContent='Choose Miles & More, then use this button to test exactly the first generated query.'; return; }
  if ($('tripType').value!=='roundtrip') { $('runStatus').textContent='Round-trip is required for the current Miles & More fare-combination calibration. Choose Round trip so both dates are entered.'; return; }
  // Chrome closes a toolbar popup after this action; always leave the in-page M&M monitor available instead.
  $('mmPinnedOverlay').checked=true;
  const settings=await saveSettings();
  settings.searchDefinition=formInput();
  settings.retriesPerQuery=1;
  setRunState('STARTING','Test request sent. Waiting for Miles & More to confirm the booking form.');
  showActivity([{at:new Date().toISOString(),detail:'Test request sent. The extension has not yet touched the M&M page.',phase:'STARTING'}]);
  const reply=await chrome.runtime.sendMessage({type:'TEST_MILES_AND_MORE',tasks:[matrix[0]],settings});
  if (reply?.error) setRunState('ERROR',reply.error);
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
function rowHtml(r) {
  const cash=r.cash_total_per_person===''?'':`${r.currency || ''} ${r.cash_total_per_person}`.trim();
  return `<tr><td class="status-${escapeHtml(r.status)}">${escapeHtml(r.status)}</td><td>${escapeHtml(`${r.origin}-${r.destination}`)}</td><td>${escapeHtml(`${r.outbound_date}${r.return_date?` / ${r.return_date}`:''}`)}</td><td>${escapeHtml(r.cabin_requested)}</td><td>${escapeHtml(r.mileage_price)}</td><td>${escapeHtml(cash)}</td><td>${escapeHtml(r.attempt)}</td></tr>`;
}
function summaryHtml(r) {
  const cash=r.best_cash_price===''?'':`${r.currency || ''} ${r.best_cash_price}`.trim();
  return `<tr><td class="status-${escapeHtml(r.final_status)}">${escapeHtml(r.final_status)}</td><td>${escapeHtml(`${r.origin}-${r.destination}`)}</td><td>${escapeHtml(`${r.outbound_date}${r.return_date?` / ${r.return_date}`:''}`)}</td><td>${escapeHtml(r.cabin_requested)}</td><td>${escapeHtml(r.attempts_recorded)}</td><td>${escapeHtml(r.best_mileage_price)}</td><td>${escapeHtml(cash)}</td></tr>`;
}
function bestHtml(r) {
  const cash=r.best_cash_price===''?'':`${r.currency || ''} ${r.best_cash_price}`.trim();
  const route=r.return_origin?`${r.origin}-${r.destination} / ${r.return_origin}-${r.return_destination}`:`${r.origin}-${r.destination}`;
  return `<tr><td class="status-${escapeHtml(r.final_status)}">${escapeHtml(r.final_status)}</td><td>${escapeHtml(route)}</td><td>${escapeHtml(`${r.outbound_date}${r.return_date?` / ${r.return_date}`:''}`)}</td><td>${escapeHtml(r.cabin_requested)}</td><td>${escapeHtml(r.best_mileage_price)}</td><td>${escapeHtml(cash)}</td><td>${escapeHtml(String(r.last_checked_at||'').slice(0,16))}<br><button class="historyButton" data-query-key="${escapeHtml(r.query_key)}">History</button></td></tr>`;
}
async function updateTripTypeFields() { const open=$('tripType').value==='openjaw'; $('openJawFields').style.display=open?'grid':'none'; }

async function refreshResults() {
  const [results,summaries,best]=await Promise.all([getResults(500),getSummaries(500),getCurrentBest(500)]);
  $('resultsBody').innerHTML=results.map(rowHtml).join(''); $('resultCount').textContent=`${results.length} most recent observations shown.`;
  $('summariesBody').innerHTML=summaries.map(summaryHtml).join(''); $('summaryCount').textContent=`${summaries.length} most recent query summaries shown.`;
  const adapterFilter=$('bestAdapterFilter')?.value || ''; const statusFilter=$('bestStatusFilter')?.value || '';
  const filteredBest=best.filter(r=>(!adapterFilter||r.adapter===adapterFilter)&&(!statusFilter||r.final_status===statusFilter));
  $('bestBody').innerHTML=filteredBest.map(bestHtml).join(''); $('bestCount').textContent=`${filteredBest.length} shown of ${best.length} normalized search key(s).`;
  return results;
}
async function showHistory(queryKey) {
  const rows=(await getResultsForQuery(queryKey)).sort((a,b)=>String(b.checked_at||'').localeCompare(String(a.checked_at||'')));
  $('historyDetail').innerHTML=historyDetailHtml(rows);
}

async function syncPending() {
  const settings=await saveSettings(); const [results,summaries,runs,best]=await Promise.all([getUnsyncedResults(250),getUnsyncedSummaries(250),getRuns(500),getCurrentBest(5000)]);
  if (!results.length && !summaries.length && !runs.length && !best.length) { $('syncStatus').textContent='Nothing pending.'; return; }
  $('syncStatus').textContent=`Syncing observations, queries, runs and current-best rows...`;
  try {
    let appendedResults=0, appendedSummaries=0;
    if (results.length) { const reply=await syncResultsToSheets({url:settings.sheetsWebAppUrl,token:settings.sheetsToken,results}); appendedResults=reply.appended ?? results.length; await markSynced(results.map(r=>r.result_id)); }
    if (summaries.length) { const reply=await syncSummariesToSheets({url:settings.sheetsWebAppUrl,token:settings.sheetsToken,summaries}); appendedSummaries=reply.appended ?? summaries.length; await markSummariesSynced(summaries.map(r=>r.summary_id)); }
    if (runs.length) await syncRunsToSheets({url:settings.sheetsWebAppUrl,token:settings.sheetsToken,runs});
    if (best.length) await syncCurrentBestToSheets({url:settings.sheetsWebAppUrl,token:settings.sheetsToken,rows:best});
    $('syncStatus').textContent=`Synced ${appendedResults} observation(s), ${appendedSummaries} query row(s), ${runs.length} run(s), ${best.length} current-best row(s).`;
  } catch (error) {
    if (results.length) await markSyncError(results.map(r=>r.result_id),String(error));
    if (summaries.length) await markSummariesSyncError(summaries.map(r=>r.summary_id),String(error));
    $('syncStatus').textContent=`Sync failed: ${error}`;
  }
  await refreshResults();
}

function genericPageParser() {
  const bodyText=document.body?.innerText || ''; const lower=bodyText.toLowerCase().replace(/\s+/g,' ');
  if (/captcha|verify you are human|security check|verification code|two-factor|2-factor/.test(lower)) return {status:'NEEDS_USER',statusDetail:'Authentication or human verification is visible on the page.',rawExcerpt:bodyText.slice(0,1800)};
  const flightNumbers=[...new Set(bodyText.match(/\b[A-Z]{2,3}\s?\d{1,4}\b/g) || [])].slice(0,20);
  const miles=[...bodyText.matchAll(/([\d.,\s]+)\s*(?:miles|meilen)/gi)].map(m=>Number(String(m[1]).replace(/[^\d]/g,''))).filter(Boolean);
  const eur=[...bodyText.matchAll(/€\s*([\d.,\s]+)/g)].map(m=>Number(String(m[1]).replace(/\s/g,'').replace('.','').replace(',','.'))).filter(Number.isFinite);
  const usd=[...bodyText.matchAll(/\$\s*([\d.,\s]+)/g)].map(m=>Number(String(m[1]).replace(/\s/g,'').replace(/,/g,''))).filter(Number.isFinite);
  if (flightNumbers.length || miles.length || eur.length || usd.length) return {status:'AVAILABLE',statusDetail:'Candidate result captured from visible page text. Cash is not ranked until confirmed as per-person total including fees.',mileagePrice:miles.length?Math.min(...miles):'',cashPrice:eur.length?Math.min(...eur):usd.length?Math.min(...usd):'',currency:eur.length?'EUR':usd.length?'USD':'',priceScope:'UNKNOWN',priceKind:'UNKNOWN',priceComparable:false,feesIncluded:false,flightNumbers,rawExcerpt:bodyText.slice(0,1800)};
  if (/no flights available|no award.*available|not available|no results|keine.*verfügbar|nicht verfügbar/.test(lower)) return {status:'NO_RESULT',statusDetail:'Visible page text indicates no availability.',rawExcerpt:bodyText.slice(0,1800)};
  return {status:'INCONCLUSIVE',statusDetail:'No recognizable flight result was found in visible page text.',rawExcerpt:bodyText.slice(0,1800)};
}
async function captureCurrentPage() {
  rebuildMatrix(); if (matrix.length!==1) { $('runStatus').textContent='For manual capture, configure exactly one query in the matrix.'; return; }
  const query=matrix[0]; const [tab]=await chrome.tabs.query({active:true,currentWindow:true}); if (!tab?.id) return;
  let parsed;
  try {
    if ((tab.url || '').includes('miles-and-more.com')) parsed=(await chrome.tabs.sendMessage(tab.id,{type:'FSM_CAPTURE_CURRENT',query:{cabin:query.cabin}}))?.parsed;
    else if ((tab.url || '').includes('lufthansa.com') || (tab.url || '').includes('brusselsairlines.com')) parsed=(await chrome.tabs.sendMessage(tab.id,{type:'FSM_LHG_CAPTURE_CURRENT',query}))?.parsed;
    else parsed=(await chrome.scripting.executeScript({target:{tabId:tab.id},func:genericPageParser}))?.[0]?.result;
  }
  catch(error) { parsed={status:'INCONCLUSIVE',statusDetail:String(error),rawExcerpt:''}; }
  const result=makeObservation({runId:`manual-${new Date().toISOString()}`,query,attempt:1,parsed,sourceUrl:tab.url || ''}); await saveResult(result); $('runStatus').textContent=`Captured current page as ${result.status}.`; await refreshResults();
}
function downloadJson(name, value) {
  const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
}
async function downloadBrowserGate() {
  const stored=await chrome.storage.local.get('latestLiveBrowserGate');
  const proof=stored.latestLiveBrowserGate;
  if (!proof) { $('runStatus').textContent='No verified browser test is available yet. Complete a guided M&M test through result navigation first.'; return; }
  downloadJson('miles-and-more-browser-gate.json',proof);
  $('runStatus').textContent='Release-test proof downloaded. Place it at tests/live/miles-and-more-browser-gate.json before packaging a release.';
}
async function exportProfiles() {
  const stored=await chrome.storage.local.get('profiles'); downloadJson(`flight-search-profiles-${new Date().toISOString().slice(0,10)}.json`,{format:'flight-search-matrix-profiles',version:1,profiles:stored.profiles||{}});
}
async function importProfiles(file) {
  if (!file) return; const payload=JSON.parse(await file.text()); const incoming=payload.profiles || payload; if (!incoming || typeof incoming!=='object') throw new Error('Invalid profile export.');
  const stored=await chrome.storage.local.get('profiles'); await chrome.storage.local.set({profiles:{...(stored.profiles||{}),...incoming}}); await loadProfiles(); $('matrixInfo').textContent=`Imported ${Object.keys(incoming).length} profile(s).`;
}
async function cloneLastRun() {
  const runs=await getRuns(100); const run=runs.find(r=>r.search_definition_json && Object.keys(r.search_definition_json||{}).length); if (!run) { $('runStatus').textContent='No prior run definition is available.'; return; }
  applyProfile(run.search_definition_json); $('runStatus').textContent=`Cloned search definition from run ${String(run.run_id||'').slice(0,8)}.`;
}
async function captureDiagnostic() {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true}); if (!tab?.id) return;
  let diagnostic={url:tab.url||'',capturedAt:new Date().toISOString()};
  try {
    if ((tab.url||'').includes('lufthansa.com') || (tab.url||'').includes('brusselsairlines.com')) diagnostic={...diagnostic,...((await chrome.tabs.sendMessage(tab.id,{type:'FSM_LHG_DIAGNOSTIC'}))?.diagnostic||{})};
    else if ((tab.url||'').includes('miles-and-more.com')) diagnostic={...diagnostic,...((await chrome.tabs.sendMessage(tab.id,{type:'FSM_MM_DIAGNOSTIC'}))?.diagnostic||{})};
    else diagnostic={...diagnostic,excerpt:(await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>document.body?.innerText?.slice(0,5000)||''}))?.[0]?.result||''};
    const worker=await chrome.runtime.sendMessage({type:'GET_RUN_STATE'}).catch(()=>null);
    if(worker) diagnostic.worker={phase:worker.phase,detail:worker.detail,running:worker.running,runId:worker.runId,activity:worker.activity||[]};
    downloadJson(`flight-search-diagnostic-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,diagnostic); $('runStatus').textContent='Diagnostic snapshot downloaded.';
  } catch(error) { $('runStatus').textContent=`Diagnostic failed: ${error}`; }
}

async function exportCsv() {
  const results=await getResults(10000); const blob=new Blob([resultsToCsv(results)],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`flight-search-results-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
}

$('preview').addEventListener('click',rebuildMatrix); $('start').addEventListener('click',startRun); $('testMilesAndMore').addEventListener('click',testMilesAndMore);
$('pause').addEventListener('click',async()=>{ setRunState('PAUSING','Pause request sent. Waiting for M&M acknowledgement.'); const reply=await chrome.runtime.sendMessage({type:'PAUSE_RUN'}); if(reply?.error) setRunState('ERROR',reply.error); });
$('resume').addEventListener('click',async()=>{ setRunState('ACTIVE','Resume request sent.'); const reply=await chrome.runtime.sendMessage({type:'RESUME_RUN'}); if(reply?.error) setRunState('ERROR',reply.error); });
$('stop').addEventListener('click',async()=>{ setRunState('STOPPING','Stop request sent. Waiting for M&M acknowledgement.'); const reply=await chrome.runtime.sendMessage({type:'STOP_RUN'}); if(reply?.error) setRunState('ERROR',reply.error); });
$('saveSettings').addEventListener('click',saveSettings); $('syncNow').addEventListener('click',syncPending); $('captureCurrent').addEventListener('click',captureCurrentPage); $('captureDiagnostic').addEventListener('click',captureDiagnostic); $('downloadBrowserGate').addEventListener('click',downloadBrowserGate); $('cloneLastRun').addEventListener('click',cloneLastRun); $('refreshResults').addEventListener('click',refreshResults); $('exportCsv').addEventListener('click',exportCsv);
$('tripType').addEventListener('change',()=>{updateTripTypeFields(); rebuildMatrix();}); $('bestAdapterFilter').addEventListener('change',refreshResults); $('bestStatusFilter').addEventListener('change',refreshResults); $('bestBody').addEventListener('click',e=>{const b=e.target.closest('.historyButton'); if(b) showHistory(b.dataset.queryKey);});
$('saveProfile').addEventListener('click',saveProfile); $('deleteProfile').addEventListener('click',deleteProfile); $('exportProfiles').addEventListener('click',exportProfiles); $('importProfiles').addEventListener('click',()=>$('profileImportFile').click()); $('profileImportFile').addEventListener('change',e=>importProfiles(e.target.files?.[0]).catch(err=>$('matrixInfo').textContent=`Import failed: ${err}`)); $('profileSelect').addEventListener('change',async()=>{const selected=$('profileSelect').value; if(!selected) return; const stored=await chrome.storage.local.get('profiles'); const profile=(stored.profiles||{})[selected]; if(profile){ applyProfile(profile); $('profileSelect').value=selected; }});

// Observe broadcasts without claiming a response intended for the worker.
chrome.runtime.onMessage.addListener(message => {
  handleRuntimeNotification(message).catch(error=>console.error('Panel update failed',error));
  return false;
});

async function handleRuntimeNotification(message) {
  if (message.type==='RUN_STARTED') setRunState('STARTING',message.resumed?`Resuming at query ${message.startIndex+1} of ${message.total}. Waiting for the next page acknowledgement.`:`Run accepted. Waiting for the first page acknowledgement.`);
  if (message.type==='RUN_STATE') setRunState(message.phase,message.detail);
  if (message.type==='RUN_ACTIVITY') showActivity(message.activity);
  if (message.type==='BROWSER_GATE_READY') $('runStatus').textContent='Live browser test recorded. Download release-test proof from Support & diagnostics before packaging.';
  if (message.type==='QUERY_PROGRESS') setRunState('ACTIVE',`Query ${message.index}/${message.total}: ${message.query.origin}-${message.query.destination} ${message.query.outboundDate} ${message.query.cabin}, attempt ${message.attempt}/${message.retries}`);
  if (message.type==='RUN_PROGRESS') setRunState('ACTIVE',`Completed ${message.completed}/${message.total} queries.`);
  if (message.type==='RESULT_SAVED' || message.type==='SUMMARY_SAVED') await refreshResults();
  if (message.type==='RUN_FINISHED') { const phase=message.status==='COMPLETE'?'COMPLETED':message.status; setRunState(phase,message.detail || `Run ${message.status.toLowerCase()} - ${message.completed}/${message.total} queries.`); const settings=await loadSettings(); if (settings.autoSync) await syncPending(); }
  if (message.type==='RUN_ERROR') setRunState('ERROR',`Run error: ${message.error}`);
}

(async()=>{
  await Promise.all([loadSettings(),loadProfiles(),refreshResults()]); updateTripTypeFields();
  await restorePlanDraft();
  for(const event of ['input','change']) $('planSection').addEventListener(event,()=>savePlanDraft().catch(()=>{}));
  const runState=await chrome.runtime.sendMessage({type:'GET_RUN_STATE'});
  $('extensionVersion').textContent=`v${EXTENSION_VERSION}`;
  showActivity(runState.activity || []);
  if (runState.running) setRunState(runState.phase||'STARTING',runState.detail||`Run active - ${runState.completed}/${runState.total}.`);
  else if (runState.recoverable) setRunState('PAUSED',runState.detail||`Interrupted run recoverable - ${runState.completed}/${runState.total} completed. Click Resume to continue.`);
  else setRunState(runState.phase||'IDLE',runState.detail||'Ready.');
  $('adapter').addEventListener('change',()=>updateRunControls($('runStateLabel').textContent));
})();
