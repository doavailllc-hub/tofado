import 'dotenv/config';
import { pool } from '../src/db.js';
import { authColumns, registrationColumns, checkColumns } from '../src/schema.js';
const required = {
  ...authColumns, ...registrationColumns,
  users: [...authColumns.users, 'logo_key', 'description', 'website'],
  purchase_orders: ['id', 'retailer_id', 'wholesaler_id', 'total_amount'],
  invoices: ['id', 'source_type', 'order_id', 'catalog_order_id', 'retailer_id', 'wholesaler_id', 'customer_name', 'total_amount', 'paid_amount', 'payment_type', 'lifecycle_status'],
  payments: ['id', 'invoice_id', 'retailer_id', 'wholesaler_id', 'amount', 'idempotency_key'],
  wholesale_catalogs: ['id', 'wholesaler_id', 'slug', 'is_published'],
  wholesale_products: ['id', 'wholesaler_id', 'price_mode', 'stock_quantity'],
  wholesale_catalog_orders: ['id', 'catalog_id', 'wholesaler_id'],
  wholesale_catalog_order_items: ['id', 'order_id', 'product_id'],
  wholesale_catalog_deliveries: ['id', 'order_id', 'wholesaler_id'],
  wholesale_catalog_enquiries: ['id', 'wholesaler_id'],
  wholesaler_retailers: ['id', 'wholesaler_id', 'retailer_id', 'status'],
};
try {
  const missing = await checkColumns(pool, required);
  const [foreignKeys] = await pool.query("SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL");
  console.log(JSON.stringify({ missing, foreignKeys, note: 'Metadata only. An empty missing list is not financial reconciliation or full schema certification.' }, null, 2));
  if (missing.length) process.exitCode = 1;
} catch (error) { console.error('Schema check failed:', error.code || error.name); process.exitCode = 1; }
finally { await pool.end(); }
