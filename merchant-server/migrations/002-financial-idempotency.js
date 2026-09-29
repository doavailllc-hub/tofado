// Forward-only, idempotent DDL. Apply before deploying payment routes that use idempotency_key.
export async function up(connection) {
  const [columns] = await connection.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payments'`);
  if (!columns.some(row => row.COLUMN_NAME === 'id')) throw new Error('Import the reviewed payments schema before the financial migration.');
  if (!columns.some(row => row.COLUMN_NAME === 'idempotency_key')) {
    await connection.query('ALTER TABLE payments ADD COLUMN idempotency_key VARCHAR(64) NULL AFTER reference_no');
  }
  const [indexes] = await connection.query(`
    SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payments' AND INDEX_NAME='uq_payments_retailer_idempotency'`);
  if (!indexes.length) {
    await connection.query('CREATE UNIQUE INDEX uq_payments_retailer_idempotency ON payments(retailer_id, idempotency_key)');
  }
}
