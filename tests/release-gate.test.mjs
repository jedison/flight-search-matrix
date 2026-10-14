import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const gate=await readFile(new URL('../scripts/release-check.mjs',import.meta.url),'utf8');
const packager=await readFile(new URL('../scripts/package-release.mjs',import.meta.url),'utf8');

test('release packaging requires a fresh live browser proof', () => {
  assert.match(gate,/miles-and-more-browser-gate\.json/);
  assert.match(gate,/72\*60\*60\*1000/);
  assert.match(gate,/search_submitted_once/);
  assert.match(gate,/result_navigation_verified/);
  assert.match(packager,/scripts\/release-check\.mjs/);
});
