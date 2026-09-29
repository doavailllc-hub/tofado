import 'dotenv/config';
import { pool } from '../src/db.js';

const checks = [
  ['invoice_order_party_mismatch', `
    SELECT COUNT(*) AS count
    FROM invoices i
    LEFT JOIN purchase_orders o ON o.id=i.order_id
    WHERE i.source_type='purchase_order' AND (o.id IS NULL OR o.retailer_id<>i.retailer_id OR o.wholesaler_id<>i.wholesaler_id)`],
  ['payment_invoice_party_mismatch', `
    SELECT COUNT(*) AS count
    FROM payments p
    LEFT JOIN invoices i ON i.id=p.invoice_id
    WHERE i.id IS NULL OR NOT(i.retailer_id <=> p.retailer_id) OR i.wholesaler_id<>p.wholesaler_id`],
  ['invalid_financial_amount', `
    SELECT
      (SELECT COUNT(*) FROM invoices WHERE total_amount<0 OR paid_amount<0 OR paid_amount>total_amount) +
      (SELECT COUNT(*) FROM payments WHERE amount<=0) AS count`],
  ['invoice_ledger_mismatch', `
    SELECT COUNT(*) AS count FROM (
      SELECT i.id
      FROM invoices i
      LEFT JOIN payments p ON p.invoice_id=i.id
      GROUP BY i.id, i.paid_amount
      HAVING ABS(i.paid_amount-COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END),0))>0.001
    ) mismatches`],
  ['invoice_overcommitted', `
    SELECT COUNT(*) AS count FROM (
      SELECT i.id
      FROM invoices i
      LEFT JOIN payments p ON p.invoice_id=i.id
      GROUP BY i.id, i.total_amount
      HAVING COALESCE(SUM(CASE WHEN p.status IN ('paid','pending') THEN p.amount ELSE 0 END),0)>i.total_amount+0.001
    ) overcommitted`],
  ['catalog_invoice_order_mismatch', `
    SELECT COUNT(*) AS count
    FROM invoices i
    LEFT JOIN wholesale_catalog_orders o ON o.id=i.catalog_order_id
    WHERE i.source_type='catalog_order' AND (o.id IS NULL OR o.wholesaler_id<>i.wholesaler_id)`],
  ['legacy_catalog_invoice_unmigrated', `
    SELECT COUNT(*) AS count FROM wholesale_catalog_invoices legacy
    LEFT JOIN invoices i ON i.source_type='catalog_order' AND i.catalog_order_id=legacy.order_id
    WHERE i.id IS NULL`],
];

try {
  const results = {};
  for (const [name, sql] of checks) {
    const [[row]] = await pool.query(sql);
    results[name] = Number(row.count);
  }
  const [foreignKeys] = await pool.query(`
    SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA=DATABASE()
      AND ((TABLE_NAME='invoices' AND COLUMN_NAME='order_id')
        OR (TABLE_NAME='payments' AND COLUMN_NAME='invoice_id'))`);
  const expected = new Set(['invoices.order_id>purchase_orders.id', 'payments.invoice_id>invoices.id']);
  for (const key of foreignKeys) expected.delete(`${key.TABLE_NAME}.${key.COLUMN_NAME}>${key.REFERENCED_TABLE_NAME}.${key.REFERENCED_COLUMN_NAME}`);
  results.missing_canonical_foreign_keys = expected.size;
  const [[idempotencyIndex]] = await pool.query(`
    SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payments'
      AND INDEX_NAME='uq_payments_retailer_idempotency' AND NON_UNIQUE=0`);
  results.missing_payment_idempotency_index = Number(idempotencyIndex.count) ? 0 : 1;
  const [[originConstraint]] = await pool.query(`SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND CONSTRAINT_NAME='chk_invoices_single_origin'`);
  results.missing_invoice_origin_constraint = Number(originConstraint.count) ? 0 : 1;
  console.log(JSON.stringify(results, null, 2));
  if (Object.values(results).some(Boolean)) process.exitCode = 1;
} catch (error) {
  console.error('Financial integrity check failed:', error.code || error.name);
  process.exitCode = 1;
} finally {
  await pool.end();
}
