import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePurchaseOrder, canTransition, recordNumber } from '../src/utils/orders.js';
const order = { wholesaler_id: 1, delivery_address: 'Shop address', items: [{ product_name: 'Rice', quantity: 1, unit: 'kg' }] };
test('orders reject invalid quantities, oversized input and impossible dates', () => {
  assert.equal(validatePurchaseOrder(order).items[0].quantity, 1);
  for (const quantity of [-1, 0, Infinity, NaN, 1.001]) assert.throws(() => validatePurchaseOrder({ ...order, items: [{ ...order.items[0], quantity }] }));
  assert.throws(() => validatePurchaseOrder({ ...order, required_date: '2026-02-30' }));
  assert.throws(() => validatePurchaseOrder({ ...order, items: Array(101).fill(order.items[0]) }));
});
test('terminal states cannot be reopened and IDs are short and collision resistant', () => {
  assert.equal(canTransition('delivered', 'pending'), false);
  assert.equal(canTransition('cancelled', 'confirmed'), false);
  assert.equal(canTransition('pending', 'delivered'), false);
  assert.equal(canTransition('pending', 'confirmed'), true);
  assert.equal(canTransition('confirmed', 'confirmed'), true);
  const ids = new Set(Array.from({ length: 1000 }, () => recordNumber('PO')));
  assert.equal(ids.size, 1000); assert.ok([...ids].every(id => id.length <= 30));
});
