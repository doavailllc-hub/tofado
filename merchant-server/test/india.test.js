import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidGstin, isValidIndianPhone, isValidIndianPinCode, normalizeGstin, normalizeIndianPhone } from '../src/utils/india.js';

test('GSTIN values are normalized and structurally validated', () => {
  assert.equal(normalizeGstin(' 27aapfu0939f1zv '), '27AAPFU0939F1ZV');
  assert.equal(isValidGstin('27AAPFU0939F1ZV'), true);
  assert.equal(isValidGstin(''), true);
  assert.equal(isValidGstin('VAT-123'), false);
  assert.equal(isValidGstin('27AAPFU0939F1Z'), false);
});

test('Indian mobile numbers and PIN codes are normalized and validated', () => {
  assert.equal(normalizeIndianPhone('+91 98765 43210'), '9876543210');
  assert.equal(normalizeIndianPhone('09876543210'), '9876543210');
  assert.equal(isValidIndianPhone('98765-43210'), true);
  assert.equal(isValidIndianPhone('1234567890'), false);
  assert.equal(isValidIndianPinCode('560001'), true);
  assert.equal(isValidIndianPinCode('056001'), false);
});
