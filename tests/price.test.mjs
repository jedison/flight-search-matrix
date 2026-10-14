import test from 'node:test';
import assert from 'node:assert/strict';
import { comparableCashTotal, isComparableCash } from '../src/price.js';

test('per-person total including fees is comparable', () => {
  const parsed={cashPrice:845,priceScope:'PER_PERSON',feesIncluded:true,priceKind:'TOTAL_WITH_FEES'};
  assert.equal(comparableCashTotal(parsed,2),845);
  assert.equal(isComparableCash(parsed,2),true);
});

test('party total is converted to per-person total', () => {
  const parsed={cashPrice:1690,priceScope:'PARTY_TOTAL',feesIncluded:true,priceKind:'TOTAL_WITH_FEES'};
  assert.equal(comparableCashTotal(parsed,2),845);
});

test('from fare is stored but never ranked as comparable', () => {
  const parsed={cashPrice:799,priceScope:'PER_PERSON',feesIncluded:false,priceKind:'FROM_FARE'};
  assert.equal(comparableCashTotal(parsed,2),'');
  assert.equal(isComparableCash(parsed,2),false);
});

