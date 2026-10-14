import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAdapterDescriptor, BUILTIN_ADAPTERS } from '../src/adapter-contract.js';

test('built-in adapter descriptors satisfy contract', () => {
  for (const descriptor of Object.values(BUILTIN_ADAPTERS)) assert.equal(validateAdapterDescriptor(descriptor).valid,true);
});

