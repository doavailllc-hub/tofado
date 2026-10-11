async function addColumn(connection, name, definition) {
  const [rows] = await connection.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='wholesale_catalog_enquiries' AND COLUMN_NAME=?`, [name]);
  if (!rows.length) await connection.query(`ALTER TABLE wholesale_catalog_enquiries ADD COLUMN ${name} ${definition}`);
}

export async function up(connection) {
  await addColumn(connection, 'quote_unit_price', 'DECIMAL(14,2) NULL AFTER status');
  await addColumn(connection, 'quote_gst_rate', 'DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER quote_unit_price');
  await addColumn(connection, 'quote_delivery_fee', 'DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER quote_gst_rate');
  await addColumn(connection, 'quote_valid_until', 'DATETIME NULL AFTER quote_delivery_fee');
  await addColumn(connection, 'quote_notes', 'VARCHAR(500) NULL AFTER quote_valid_until');
  await addColumn(connection, 'quote_token_hash', 'CHAR(64) NULL AFTER quote_notes');
  await addColumn(connection, 'quote_sent_at', 'DATETIME NULL AFTER quote_token_hash');
  await addColumn(connection, 'quote_accepted_at', 'DATETIME NULL AFTER quote_sent_at');
  await addColumn(connection, 'quote_order_id', 'BIGINT UNSIGNED NULL AFTER quote_accepted_at');
  const [indexes] = await connection.query(`SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='wholesale_catalog_enquiries' AND INDEX_NAME='uq_enquiry_quote_token'`);
  if (!indexes.length) await connection.query('CREATE UNIQUE INDEX uq_enquiry_quote_token ON wholesale_catalog_enquiries(quote_token_hash)');
}
