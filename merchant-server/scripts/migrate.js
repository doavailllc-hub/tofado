import 'dotenv/config';
import mysql from 'mysql2/promise';
import { up } from '../migrations/001-auth-registration.js';
import { up as financialUp } from '../migrations/002-financial-idempotency.js';
import { up as unifiedInvoicesUp } from '../migrations/003-unified-invoices.js';
import { up as invoiceOriginConstraintUp } from '../migrations/004-invoice-origin-constraint.js';
import { up as storefrontRetailerLinkUp } from '../migrations/005-storefront-retailer-link.js';

if (process.argv.includes('--help')) {
  console.log('Runs ordered forward-only schema migrations using MIGRATION_DB_* variables. It does not rewrite financial balances. Test on staging and record a restore point first.');
  process.exit(0);
}
for (const name of ['MIGRATION_DB_HOST', 'MIGRATION_DB_USER', 'MIGRATION_DB_PASSWORD', 'MIGRATION_DB_NAME']) {
  if (!process.env[name]) throw new Error(name + ' is required. Runtime credentials are intentionally not reused.');
}
const connection = await mysql.createConnection({
  host: process.env.MIGRATION_DB_HOST, port: Number(process.env.MIGRATION_DB_PORT || 3306),
  user: process.env.MIGRATION_DB_USER, password: process.env.MIGRATION_DB_PASSWORD, database: process.env.MIGRATION_DB_NAME,
});
try {
  const [[lock]] = await connection.query("SELECT GET_LOCK('tofado_schema_migration', 10) AS acquired");
  if (Number(lock.acquired) !== 1) throw new Error('Another migration is running.');
  await connection.query('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  const migrations = [
    ['001-auth-registration', up],
    ['002-financial-idempotency', financialUp],
    ['003-unified-invoices', unifiedInvoicesUp],
    ['004-invoice-origin-constraint', invoiceOriginConstraintUp],
    ['005-storefront-retailer-link', storefrontRetailerLinkUp],
  ];
  for (const [version, migrate] of migrations) {
    const [[existing]] = await connection.query('SELECT version FROM schema_migrations WHERE version = ?', [version]);
    if (!existing) {
      await migrate(connection);
      await connection.query('INSERT INTO schema_migrations(version) VALUES (?)', [version]);
    }
  }
  console.log('Schema migrations are up to date. Run db:check, finance:check and validate all business flows before release.');
} catch (error) {
  console.error('Migration failed:', error.code || error.name);
  process.exitCode = 1;
} finally {
  await connection.query("SELECT RELEASE_LOCK('tofado_schema_migration')").catch(() => {});
  await connection.end();
}
