async function addColumn(connection, table, column, definition) {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [table, column]
  );
  if (!rows.length) await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export async function up(connection) {
  await addColumn(connection, 'quote_requests', 'is_private', "TINYINT(1) NOT NULL DEFAULT 1 AFTER required_date");
  await addColumn(connection, 'quote_requests', 'delivery_address', "VARCHAR(500) NULL AFTER delivery_pincode");

  await addColumn(connection, 'quote_offers', 'discount_percent', "DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER unit_price");
  await addColumn(connection, 'quote_offers', 'free_units', "DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER discount_percent");
  await addColumn(connection, 'quote_offers', 'scheme_description', "VARCHAR(300) NULL AFTER free_units");
  await addColumn(connection, 'quote_offers', 'return_policy', "VARCHAR(300) NULL AFTER notes");
  await addColumn(connection, 'quote_offers', 'available_quantity', "DECIMAL(12,3) NULL AFTER return_policy");
  await addColumn(connection, 'quote_offers', 'batch_no', "VARCHAR(80) NULL AFTER available_quantity");
  await addColumn(connection, 'quote_offers', 'expiry_date', "DATE NULL AFTER batch_no");
  await addColumn(connection, 'quote_offers', 'stock_proof_url', "VARCHAR(1000) NULL AFTER expiry_date");
  await addColumn(connection, 'quote_offers', 'stock_verified_at', "TIMESTAMP NULL AFTER stock_proof_url");
  await addColumn(connection, 'quote_offers', 'updated_at', "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at");
}
