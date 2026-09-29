// Forward-only, idempotent DDL. MySQL DDL commits implicitly; rerun after fixing an interrupted migration.
export async function up(connection) {
  const [rows] = await connection.query('SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()');
  const existing = new Set(rows.map(row => row.TABLE_NAME + '.' + row.COLUMN_NAME));
  for (const table of ['users', 'merchant_applications']) {
    if (!existing.has(table + '.id')) throw new Error('Import the reviewed base schema before the auth migration.');
  }
  const fields = {
    users: { google_sub: 'VARCHAR(255) NULL UNIQUE', auth_provider: "VARCHAR(30) NOT NULL DEFAULT 'password'", verification_status: "VARCHAR(30) NOT NULL DEFAULT 'draft'", business_category: 'VARCHAR(120) NULL', shop_type: 'VARCHAR(120) NULL', logo_url: 'TEXT NULL', logo_key: 'TEXT NULL', description: 'TEXT NULL', website: 'VARCHAR(2048) NULL' },
    merchant_applications: { business_category: 'VARCHAR(120) NULL', shop_type: 'VARCHAR(120) NULL', source_user_id: 'BIGINT UNSIGNED NULL', logo_url: 'TEXT NULL' },
  };
  for (const [table, columns] of Object.entries(fields)) {
    for (const [column, definition] of Object.entries(columns)) {
      if (!existing.has(table + '.' + column)) await connection.query('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + definition);
    }
  }
  // Existing explicit approvals are preserved; active status alone is not an approval.
  if (!existing.has('users.verification_status')) {
    await connection.query("UPDATE users SET verification_status = CASE WHEN role <> 'wholesaler' THEN 'not_required' WHEN verified_at IS NOT NULL THEN 'verified' ELSE 'draft' END");
  }
await connection.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME NULL,
        INDEX idx_auth_sessions_user (user_id),
        INDEX idx_auth_sessions_expiry (expires_at)
      ) ENGINE=InnoDB
    `);
await connection.query(`
      CREATE TABLE IF NOT EXISTS email_login_codes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(190) NOT NULL,
        code_hash CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
        used_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_login_lookup (email, created_at),
        INDEX idx_email_login_expiry (expires_at)
      ) ENGINE=InnoDB
    `);
}
