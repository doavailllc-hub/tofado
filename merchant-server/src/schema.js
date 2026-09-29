export const authColumns = {
  users: ['id', 'role', 'status', 'google_sub', 'auth_provider', 'verification_status', 'business_category', 'shop_type', 'logo_url'],
  auth_sessions: ['id', 'user_id', 'token_hash', 'expires_at', 'revoked_at', 'last_used_at'],
  email_login_codes: ['id', 'email', 'code_hash', 'expires_at', 'attempts', 'used_at', 'created_at'],
};
export const registrationColumns = {
  merchant_applications: ['source_user_id', 'business_category', 'shop_type', 'logo_url'],
};
export async function checkColumns(connection, required) {
  const [rows] = await connection.query('SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()');
  const present = new Set(rows.map(row => row.TABLE_NAME + '.' + row.COLUMN_NAME));
  return Object.entries(required).flatMap(([table, columns]) => columns.filter(column => !present.has(table + '.' + column)).map(column => table + '.' + column));
}
export async function requireColumns(connection, required) {
  const missing = await checkColumns(connection, required);
  if (missing.length) {
    throw Object.assign(new Error('Database migrations are required: ' + missing.join(', ')), { code: 'SCHEMA_NOT_READY', status: 503 });
  }
}
