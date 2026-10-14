import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const root=process.cwd();
const proofPath=resolve(root,'tests/live/miles-and-more-browser-gate.json');
const maxAgeMs=72*60*60*1000;
const required=['form_controls_verified','form_actions_verified','search_submitted_once','result_navigation_verified'];

execFileSync(process.execPath,['scripts/verify.mjs'],{stdio:'inherit'});

let proof;
try { proof=JSON.parse(await readFile(proofPath,'utf8')); }
catch { throw new Error(`Release blocked: no live browser proof at ${proofPath}. Complete a guided M&M test through result navigation, download its release-test proof, and save it at that path.`); }

const version=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version;
const checkedAt=Date.parse(proof.verified_at || '');
const age=Date.now()-checkedAt;
const errors=[];
if (proof.schema_version !== 2) errors.push('unsupported proof schema');
if (proof.provider !== 'miles-and-more') errors.push('proof is not for Miles & More');
if (proof.extension_version !== version) errors.push(`proof version ${proof.extension_version || 'missing'} does not match ${version}`);
if (!Number.isFinite(checkedAt) || age < -5*60*1000 || age > maxAgeMs) errors.push('proof is missing, future-dated, or older than 72 hours');
for (const field of required) if (proof[field] !== true) errors.push(`${field} is not verified`);
if (!/^https:\/\/[^/]*miles-and-more\.com\//.test(proof.source_url || '')) errors.push('proof does not contain a Miles & More result URL');
if (!['AVAILABLE','NO_RESULT','INCONCLUSIVE','NEEDS_USER'].includes(proof.result_status)) errors.push('proof does not contain a recognized result status');
if (errors.length) throw new Error(`Release blocked: live browser proof failed validation: ${errors.join('; ')}.`);

console.log(`Release gate passed: live M&M browser proof from ${proof.verified_at}.`);
