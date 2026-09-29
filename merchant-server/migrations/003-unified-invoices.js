// Expands the canonical invoices ledger to cover registered purchase orders and public catalog orders.
// The legacy catalog invoice table remains read-only as migration evidence for one release cycle.
export async function up(connection) {
  const [columns] = await connection.query(`SELECT TABLE_NAME,COLUMN_NAME,IS_NULLABLE,CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('invoices','payments','wholesale_catalog_invoices')`);
  const has = (table, column) => columns.some(row => row.TABLE_NAME === table && row.COLUMN_NAME === column);
  if (!has('invoices', 'id') || !has('wholesale_catalog_invoices', 'id')) throw new Error('Both source invoice schemas are required.');
  const additions = {
    source_type: "VARCHAR(30) NOT NULL DEFAULT 'purchase_order'",
    catalog_order_id: 'BIGINT UNSIGNED NULL',
    customer_name: 'VARCHAR(150) NULL', business_name: 'VARCHAR(180) NULL',
    customer_phone: 'VARCHAR(50) NULL', customer_email: 'VARCHAR(190) NULL',
    payment_type: 'VARCHAR(40) NULL', lifecycle_status: "VARCHAR(20) NOT NULL DEFAULT 'issued'",
    paid_at: 'DATETIME NULL', updated_at: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  };
  for (const [column, definition] of Object.entries(additions)) {
    if (!has('invoices', column)) await connection.query(`ALTER TABLE invoices ADD COLUMN ${column} ${definition}`);
  }
  await connection.query('ALTER TABLE invoices MODIFY invoice_no VARCHAR(60) NOT NULL, MODIFY order_id BIGINT UNSIGNED NULL, MODIFY retailer_id BIGINT UNSIGNED NULL, MODIFY subtotal DECIMAL(14,2) NOT NULL, MODIFY tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0, MODIFY total_amount DECIMAL(14,2) NOT NULL, MODIFY paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0');
  await connection.query('ALTER TABLE payments MODIFY retailer_id BIGINT UNSIGNED NULL');
  const [[collisions]] = await connection.query('SELECT COUNT(*) count FROM wholesale_catalog_invoices c JOIN invoices i ON i.invoice_no=c.invoice_no WHERE i.source_type<>\'catalog_order\'');
  if (Number(collisions.count)) throw new Error('Catalog invoice numbers collide with canonical invoice numbers; resolve before migration.');
  await connection.query(`INSERT INTO invoices
    (invoice_no,source_type,order_id,catalog_order_id,retailer_id,wholesaler_id,customer_name,business_name,customer_phone,customer_email,subtotal,tax_amount,total_amount,paid_amount,due_date,payment_type,status,lifecycle_status,paid_at,created_at,updated_at)
    SELECT c.invoice_no,'catalog_order',NULL,c.order_id,NULL,c.wholesaler_id,c.customer_name,c.business_name,c.phone,c.email,c.total_amount,0,c.total_amount,
      LEAST(c.total_amount,COALESCE(o.paid_amount,CASE WHEN c.payment_status='paid' THEN c.total_amount ELSE 0 END)),c.payment_due_date,c.payment_type,
      CASE WHEN c.status='cancelled' THEN 'cancelled' WHEN c.payment_status='paid' THEN 'paid' WHEN COALESCE(o.paid_amount,0)>0 THEN 'partial' ELSE 'unpaid' END,
      c.status,c.paid_at,c.created_at,c.updated_at
    FROM wholesale_catalog_invoices c JOIN wholesale_catalog_orders o ON o.id=c.order_id AND o.wholesaler_id=c.wholesaler_id
    LEFT JOIN invoices i ON i.source_type='catalog_order' AND i.catalog_order_id=c.order_id
    WHERE i.id IS NULL`);
  const [indexes] = await connection.query(`SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices'`);
  if (!indexes.some(row => row.INDEX_NAME === 'uq_invoices_catalog_order')) await connection.query('CREATE UNIQUE INDEX uq_invoices_catalog_order ON invoices(catalog_order_id)');
  const [fks] = await connection.query(`SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='catalog_order_id' AND REFERENCED_TABLE_NAME='wholesale_catalog_orders'`);
  if (!fks.length) await connection.query('ALTER TABLE invoices ADD CONSTRAINT fk_invoices_catalog_order FOREIGN KEY (catalog_order_id) REFERENCES wholesale_catalog_orders(id)');
}
