export async function up(connection) {
  const [checks] = await connection.query(`SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND CONSTRAINT_NAME='chk_invoices_single_origin'`);
  if (!checks.length) await connection.query(`ALTER TABLE invoices ADD CONSTRAINT chk_invoices_single_origin CHECK (
    (source_type='purchase_order' AND order_id IS NOT NULL AND catalog_order_id IS NULL AND retailer_id IS NOT NULL)
    OR (source_type='catalog_order' AND order_id IS NULL AND catalog_order_id IS NOT NULL)
  )`);
}
