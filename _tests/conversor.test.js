// Run with: node --test _tests
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const cv = require('../assets/js/conversor.js');

test('one product: 10 mg in 2 mL, 2.5 mg = 50 units', () => {
  const r = cv.convert(10, 2, 2.5);
  assert.equal(r.concentration, 5);
  assert.equal(r.volumeMl, 0.5);
  assert.equal(r.units, 50);
  assert.equal(r.timesInVial, 4);
});

test('mixture: every product shares one vial and one diluent', () => {
  // 10 mg of A + 5 mg of B + 2 mg of C in 3 mL; the dose is 2.5 mg of A.
  const r = cv.convertBlend([10, 5, 2], 3, 0, 2.5);
  assert.equal(r.volumeMl, 0.75);
  assert.equal(r.units, 75);
  assert.deepEqual(r.concentrations, [10 / 3, 5 / 3, 2 / 3]);
  assert.deepEqual(r.amounts, [2.5, 1.25, 0.5]);
  assert.equal(r.totalMg, 17);
  // The whole vial runs out at the same time for every product.
  assert.equal(r.timesInVial, 4);
});

test('mixture: the reference can be any product', () => {
  const r = cv.convertBlend([10, 5], 2, 1, 1);
  assert.equal(r.volumeMl, 0.4);
  assert.equal(r.units, 40);
  assert.deepEqual(r.amounts, [2, 1]);
  assert.equal(r.timesInVial, 5);
});

test('mixture: invalid input returns null', () => {
  assert.equal(cv.convertBlend([10, 0], 2, 0, 1), null);
  assert.equal(cv.convertBlend([10, 5], 0, 0, 1), null);
  assert.equal(cv.convertBlend([10, 5], 2, 0, 0), null);
  assert.equal(cv.convertBlend([10, 5], 2, 2, 1), null);
  assert.equal(cv.convertBlend([], 2, 0, 1), null);
});

test('mixture: rounds like the single-product mode', () => {
  // 0.333... mL -> 33.3 units; the vial yields 6 times.
  const r = cv.convertBlend([6, 3], 2, 0, 1);
  assert.equal(r.units, 33.3);
  assert.equal(r.timesInVial, 6);
});

test('reverse: 50 units of 10 mg in 2 mL = 2.5 mg', () => {
  const r = cv.reverse(10, 2, 50);
  assert.equal(r.amountMg, 2.5);
});
