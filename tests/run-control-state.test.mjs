import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const worker = await readFile(new URL('../src/service-worker.js', import.meta.url), 'utf8');
const panel = await readFile(new URL('../sidepanel.js', import.meta.url), 'utf8');
const markup = await readFile(new URL('../sidepanel.html', import.meta.url), 'utf8');

test('run controls show acknowledgement states and a persistent activity timeline', () => {
  assert.match(worker, /setPhase\('STOPPING'/);
  assert.match(worker, /acknowledgeStop/);
  assert.match(worker, /type:'RUN_ACTIVITY'/);
  assert.match(worker, /TEST_MILES_AND_MORE/);
  assert.match(worker, /recordLiveBrowserGate/);
  assert.match(panel, /function showActivity/);
  assert.match(panel, /type:'GET_RUN_STATE'/);
  assert.match(panel, /downloadBrowserGate/);
  assert.match(panel, /WAITING_FOR_USER/);
  assert.match(markup, /id="runTimeline"/);
  assert.match(markup, /class="run-console"/);
  assert.match(markup, /class="run-command-bar"/);
  assert.match(markup, /id="testMilesAndMore"[\s\S]*id="stop"/);
  assert.match(markup, /id="stop"[\s\S]*id="captureDiagnostic"[\s\S]*id="captureCurrent"/);
  assert.match(markup, /id="stop"[\s\S]*id="runState"/);
  assert.match(markup, /id="captureDiagnostic"/);
  assert.match(markup, /id="downloadBrowserGate"/);
  assert.match(worker, /NATIVE_DEBUGGER_ATTACHED/);
  assert.match(worker, /NATIVE_CLICK_DISPATCHED/);
});
