import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('purchase invoice payment routes never query the catalog invoice table', () => {
  const source = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bwholesale_invoices\b/);
  assert.doesNotMatch(source, /\bwholesale_catalog_invoices\b/);
  const start = source.indexOf('"/api/retailer/invoices/:id/payments"');
  const end = source.indexOf('// RETAILER: SEARCH VERIFIED WHOLESALERS', start);
  assert.ok(start > 0 && end > start);
  const paymentWorkflow = source.slice(start, end);
  assert.doesNotMatch(paymentWorkflow, /wholesale_catalog_invoices/);
  assert.match(paymentWorkflow, /FROM invoices i/);
  assert.match(paymentWorkflow, /UPDATE invoices/);
});
