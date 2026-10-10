export async function up(connection) {
  const [columns] = await connection.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='wholesale_catalog_orders'`);
  if (!columns.some(row => row.COLUMN_NAME === 'retailer_id')) {
    await connection.query('ALTER TABLE wholesale_catalog_orders ADD COLUMN retailer_id BIGINT UNSIGNED NULL AFTER wholesaler_id');
  }
  const [indexes] = await connection.query(`SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='wholesale_catalog_orders'`);
  if (!indexes.some(row => row.INDEX_NAME === 'idx_catalog_order_retailer')) {
    await connection.query('CREATE INDEX idx_catalog_order_retailer ON wholesale_catalog_orders(retailer_id)');
  }
  const [fks] = await connection.query(`SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='wholesale_catalog_orders' AND COLUMN_NAME='retailer_id' AND REFERENCED_TABLE_NAME='users'`);
  if (!fks.length) {
    await connection.query('ALTER TABLE wholesale_catalog_orders ADD CONSTRAINT fk_catalog_order_retailer FOREIGN KEY (retailer_id) REFERENCES users(id)');
  }
}
