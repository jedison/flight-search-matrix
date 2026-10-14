import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../sidepanel.html',import.meta.url),'utf8');
const panel=await readFile(new URL('../sidepanel.js',import.meta.url),'utf8');
const originalIds=["extensionVersion","profileSelect","saveProfile","deleteProfile","exportProfiles","importProfiles","profileImportFile","adapter","origins","destinations","tripType","openJawFields","returnOrigins","returnDestinations","outboundStart","outboundEnd","returnStart","returnEnd","minNights","maxNights","adults","maxStops","maxLayoverMinutes","allowedConnectionAirports","blockedConnectionAirports","allowedCarriers","blockedCarriers","requireRequestedCabin","airportGroups","smartOrder","preview","matrixInfo","matrixPreview","testMilesAndMore","start","pause","resume","stop","captureDiagnostic","downloadBrowserGate","cloneLastRun","captureCurrent","runState","runStateLabel","runStateDetail","runStatus","runTimeline","retriesPerQuery","minDelaySeconds","maxDelaySeconds","resultWaitSeconds","maxBackoffSeconds","stopOnFirstAvailable","notificationsEnabled","sheetsWebAppUrl","sheetsToken","autoSync","saveSettings","syncNow","syncStatus","bestAdapterFilter","bestStatusFilter","bestCount","bestBody","historyDetail","summaryCount","summariesBody","refreshResults","exportCsv","resultCount","resultsBody"];
test('redesign retains every original control ID exactly once',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  for(const id of originalIds) assert.equal(ids.filter(x=>x===id).length,1,id);
});
test('Run precedes always-open Plan and collapsed monitoring, research and support',()=>{
  const order=['runHeading','planSection','monitoringSection','researchSection','supportSection'].map(id=>html.indexOf('id="'+id+'"'));
  assert.deepEqual(order,[...order].sort((a,b)=>a-b));
  assert.match(html,/<section id="planSection"/);
  for(const id of ['monitoringSection','researchSection','supportSection']) assert.match(html,new RegExp('<details id="'+id+'"[^>]*>'));
  assert.doesNotMatch(html,/<details id="(?:monitoringSection|researchSection|supportSection)"[^>]* open/);
});
test('Plan inputs remain editable through all running phases',()=>{
  const elements=Object.fromEntries(originalIds.map(id=>[id,{disabled:false,value:id==='adapter'?'miles-and-more':''}]));
  const context=vm.createContext({$:id=>elements[id]});
  vm.runInContext(panel.match(/function updateRunControls\([^]*?\n\}/)[0],context);
  for(const phase of ['IDLE','STARTING','ACTIVE','WAITING_FOR_RESULTS','PAUSED','STOPPING','INCONCLUSIVE','COMPLETED']){
    context.updateRunControls(phase);
    for(const id of ['origins','destinations','adapter','tripType','adults','outboundStart','retriesPerQuery','profileSelect']) assert.equal(elements[id].disabled,false,id+' '+phase);
  }
  context.updateRunControls('ACTIVE');
  assert.equal(elements.start.disabled,true);
  assert.equal(elements.testMilesAndMore.disabled,true);
  assert.equal(elements.stop.disabled,false);
});
test('Start matrix remains disabled for M&M during round-trip fare-combination calibration',()=>{
  assert.match(panel,/\$\('start'\)\.disabled=active \|\| \$\('adapter'\)\.value==='miles-and-more'/);
  assert.match(panel,/Miles & More matrix runs are paused while round-trip fare-combination calibration is in progress/);
  assert.match(html,/Fare-combination calibration is round-trip only and enters both dates/);
});
test('M&M test refuses one-way while round-trip fare-combination calibration is active',()=>{
  assert.match(panel,/\$\('tripType'\)\.value!=='roundtrip'/);
  assert.match(panel,/Round-trip is required for the current Miles & More fare-combination calibration/);
  assert.match(panel,/\$\('mmPinnedOverlay'\)\.checked=true/);
});
test('HTML and runtime display the manifest version',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));
  assert.ok(html.includes('v'+manifest.version));
  assert.ok(panel.includes("EXTENSION_VERSION = '"+manifest.version+"'"));
});

test('floating popup canvas and content use the intended compact 420 px width',async()=>{
  const css=await readFile(new URL('../sidepanel.css',import.meta.url),'utf8');
  assert.match(css,/:root \{ width: 420px; min-width: 420px; max-width: 420px;/);
  assert.match(css,/html, body \{ width: 420px; min-width: 420px; max-width: 420px; overflow-x: hidden; \}/);
  assert.match(css,/main \{ width: 420px; max-width: 420px;/);
  assert.doesNotMatch(css,/330px/);
});
