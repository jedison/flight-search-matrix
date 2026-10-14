import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';

const root=process.cwd();
const version=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version;
const name=`flight-search-matrix-${version}.zip`;
const output=resolve(root,name);
const checksum=resolve(root,`flight-search-matrix-${version}.sha256`);
const staging=await mkdtemp(join(tmpdir(),'flight-search-matrix-release-'));
const stagedZip=join(staging,name);
const files=['manifest.json','package.json','sidepanel.html','sidepanel.js','sidepanel.css','VERSION','README.md','CHANGELOG.md','src','tests','scripts','docs'];

try {
  execFileSync(process.execPath,['scripts/release-check.mjs'],{stdio:'inherit'});
  execFileSync('zip',['-qr',stagedZip,...files],{cwd:root,stdio:'inherit'});
  const bytes=await readFile(stagedZip);
  const hash=createHash('sha256').update(bytes).digest('hex');
  await copyFile(stagedZip,output);
  await writeFile(checksum,`${hash}  ${name}\n`,'utf8');
  console.log(`Packaged ${name} after the live-browser release gate passed.`);
} finally {
  await rm(staging,{recursive:true,force:true});
}
