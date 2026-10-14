import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const panel=await readFile(new URL('../sidepanel.js',import.meta.url),'utf8');
test('toolbar action opens popup without side-panel permission or installation setup',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));
  const worker=await readFile(new URL('../src/service-worker.js',import.meta.url),'utf8');
  assert.equal(manifest.action.default_popup,'sidepanel.html');
  assert.equal(manifest.side_panel,undefined);
  assert.ok(!manifest.permissions.includes('sidePanel'));
  assert.doesNotMatch(worker,/chrome\.sidePanel/);
  assert.deepEqual(manifest.icons,{
    '16':'icons/icon16.png','32':'icons/icon32.png','48':'icons/icon48.png','128':'icons/icon128.png'
  });
  assert.deepEqual(manifest.action.default_icon,manifest.icons);
});
test('plan draft saves and restores raw custom-group text without overwriting storage',async()=>{
  let stored={};
  const fields={airportGroups:{value:'{"unfinished":'},profileSelect:{value:'My plan'}};
  let applied;
  const ctx=vm.createContext({$:id=>fields[id],formInput:()=>({origins:'BRU',destinations:'DEN'}),chrome:{storage:{local:{set:async value=>{stored=value;},get:async()=>stored}}},applyProfile:(p,persist)=>{applied={p,persist};}});
  vm.runInContext('let draftWrites=Promise.resolve();',ctx);
  for(const name of ['savePlanDraft','restorePlanDraft'])vm.runInContext(panel.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))[0],ctx);
  await ctx.savePlanDraft();
  fields.airportGroups.value='';fields.profileSelect.value='';
  await ctx.restorePlanDraft();
  assert.equal(applied.p.origins,'BRU');
  assert.equal(applied.persist,false);
  assert.equal(fields.airportGroups.value,'{"unfinished":');
  assert.equal(fields.profileSelect.value,'My plan');
});
