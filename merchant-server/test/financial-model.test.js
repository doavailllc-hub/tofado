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

test('storefront orders preserve authenticated retailer ownership without exposing accounts', () => {
  const source = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /"\/api\/public\/catalog\/:slug\/orders",\s*optionalAuth/);
  assert.match(source, /req\.user\?\.id \|\| null/);
  assert.match(source, /order\.retailer_id/);
  assert.doesNotMatch(source, /temporary_password/);
  assert.doesNotMatch(source, /UPDATE users\s+SET\s+business_name/);
  assert.match(source, /RETAILER_ACCOUNT_REQUIRED/);
});

test('enquiry quotes use bearer-token hashes and create orders atomically', () => {
  const source = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /"\/api\/wholesaler\/catalog\/enquiries\/:id\/quote"/);
  assert.match(source, /"\/api\/public\/enquiry-quotes\/:token\/accept", optionalAuth/);
  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /WHERE e\.quote_token_hash=\? LIMIT 1 FOR UPDATE/);
  assert.match(source, /quote_order_id IS NULL/);
  assert.match(source, /INSERT INTO wholesale_catalog_orders/);
  assert.match(source, /await connection\.commit\(\)/);
});
