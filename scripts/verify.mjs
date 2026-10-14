import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
// Downloaded diagnostics are user-captured evidence, not extension source.
const excludedDirs = new Set(['.git', 'node_modules', 'releases', 'diagnostics']);
const textExt = new Set(['.js', '.mjs', '.json', '.md', '.html', '.css', '.gs', '.txt']);

function ext(name) {
  const at = name.lastIndexOf('.');
  return at >= 0 ? name.slice(at) : '';
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirs.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (textExt.has(ext(entry.name)) || entry.name === 'VERSION') out.push(path);
  }
  return out;
}

execFileSync(process.execPath, ['--test', 'tests/*.test.mjs'], { stdio: 'inherit', shell: true });

const jsFiles = (await walk(root)).filter(p => ['.js', '.mjs'].includes(ext(p)));
for (const file of jsFiles) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });

const violations = [];
for (const file of await walk(root)) {
  const content = await readFile(file, 'utf8');
  if (content.includes('\u2014')) violations.push(relative(root, file));
}
if (violations.length) {
  console.error(`Em dash found in: ${violations.join(', ')}`);
  process.exit(1);
}

console.log('Verification passed: tests, syntax, version consistency and no em dashes.');
