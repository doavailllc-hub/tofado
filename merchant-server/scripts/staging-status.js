import { connectStaging } from './staging-config.js';
let connection;
try {
  connection = await connectStaging();
  const [[status]] = await connection.query('SELECT VERSION() AS version, DATABASE() AS database_name, @@port AS port');
  const [[tables]] = await connection.query('SELECT COUNT(*) AS table_count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()');
  console.log(JSON.stringify({ ...status, ...tables, isolatedLocalTarget: true }));
} catch (error) { console.error('Staging unavailable:', error.code || error.message); process.exitCode = 1; }
finally { await connection?.end(); }
