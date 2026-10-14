import test from 'node:test';
import assert from 'node:assert/strict';
import { delayForAttempt, effectivePolicy } from '../src/provider-policy.js';

test('provider override beats global delays', () => {
  const p=effectivePolicy({minDelaySeconds:8,maxDelaySeconds:16,providerPolicies:{x:{minDelaySeconds:30,maxDelaySeconds:30}}},'x');
  assert.equal(p.minDelaySeconds,30);
});

test('backoff increases delay and respects cap', () => {
  const p={minDelaySeconds:10,maxDelaySeconds:10,maxBackoffSeconds:25,backoffMultiplier:2,jitterRatio:0};
  assert.equal(delayForAttempt(p,0,()=>0),10000);
  assert.equal(delayForAttempt(p,1,()=>0),20000);
  assert.equal(delayForAttempt(p,3,()=>0),25000);
});

