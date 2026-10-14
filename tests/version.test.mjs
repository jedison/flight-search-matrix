import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
const version = (await readFile(new URL('../VERSION', import.meta.url), 'utf8')).trim();
const panel = await readFile(new URL('../sidepanel.js', import.meta.url), 'utf8');

test('release version is synchronized', () => {
  assert.equal(packageJson.version, version);
  assert.equal(manifest.version, version);
  assert.match(panel,new RegExp(`EXTENSION_VERSION = '${version}'`));
});
