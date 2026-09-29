import test from 'node:test';
import assert from 'node:assert/strict';
import { accountDestination } from '../src/services/navigation.js';

test('sign-in restores same-role links including filters and anchors', () => {
  assert.equal(accountDestination({ role: 'retailer' }, '/retailer/invoices/12?view=payments#history'), '/retailer/invoices/12?view=payments#history');
  assert.equal(accountDestination({ role: 'admin' }), '/admin');
});

test('sign-in rejects external links, role switching and path traversal', () => {
  for (const target of ['https://example.com', '//example.com', '/retailer/../../admin', '/retailer/%2e%2e/admin', '/retailer\\evil', '/admin/users', '/retailers', null]) {
    assert.equal(accountDestination({ role: 'retailer' }, target), '/retailer');
  }
});

test('wholesaler onboarding takes precedence over saved destinations', () => {
  for (const verification_status of ['draft', 'pending', 'rejected', undefined]) {
    assert.equal(accountDestination({ role: 'wholesaler', verification_status }, '/wholesaler/orders'), '/wholesaler/profile');
  }
  assert.equal(accountDestination({ role: 'wholesaler', verification_status: 'verified' }, '/wholesaler/orders'), '/wholesaler/orders');
  assert.equal(accountDestination({ role: 'unknown' }), '/login');
});
