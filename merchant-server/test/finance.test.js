import test from 'node:test';
import assert from 'node:assert/strict';
import { availableInvoiceBalance, invoiceState, paymentIdempotencyKey, validPaymentAmount } from '../src/utils/finance.js';

test('invoice state follows confirmed payments and preserves cancellation', () => {
  assert.deepEqual(invoiceState(100, 0), { paidAmount: 0, status: 'unpaid' });
  assert.deepEqual(invoiceState(100, 25), { paidAmount: 25, status: 'partial' });
  assert.deepEqual(invoiceState(100, 100), { paidAmount: 100, status: 'paid' });
  assert.deepEqual(invoiceState(100, 25, 'cancelled'), { paidAmount: 25, status: 'cancelled' });
  assert.throws(() => invoiceState(100, 100.01));
});

test('available balance reserves pending payments and uses currency precision', () => {
  assert.equal(availableInvoiceBalance(100, 25, 30), 45);
  assert.equal(availableInvoiceBalance(10.1, 0.1, 0), 10);
  assert.equal(availableInvoiceBalance(100, 100, 20), 0);
  assert.throws(() => availableInvoiceBalance(100, -1, 0));
});

test('payment amounts fit the positive DECIMAL(12,2) domain', () => {
  assert.equal(validPaymentAmount(10.25), true);
  for (const value of [0, -1, 1.001, Infinity, NaN, 10000000000]) assert.equal(validPaymentAmount(value), false);
});

test('payment idempotency keys are bounded safe identifiers', () => {
  assert.equal(paymentIdempotencyKey('pay:12345678'), 'pay:12345678');
  assert.equal(paymentIdempotencyKey(''), null);
  assert.throws(() => paymentIdempotencyKey('short'));
  assert.throws(() => paymentIdempotencyKey('invalid key with spaces'));
});
