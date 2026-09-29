import fs from 'node:fs/promises';
import path from 'node:path';
import { connectStaging, stagingDir, validateSnapshot } from './staging-config.js';

let connection;
try {
  const snapshot = JSON.parse(await fs.readFile(path.join(stagingDir, 'schema.json'), 'utf8'));
  validateSnapshot(snapshot);
  connection = await connectStaging();
  const [[count]] = await connection.query('SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()');
  if (Number(count.total) !== 0) throw new Error('Staging is not empty. Import will never drop or overwrite existing tables.');
  await connection.query('SET SESSION FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of snapshot.tables) await connection.query(table.ddl);
  } finally { await connection.query('SET SESSION FOREIGN_KEY_CHECKS = 1'); }
  console.log(JSON.stringify({ importedTables: snapshot.tables.length, importedCustomerRows: 0, destination: '127.0.0.1:3307/tofado_staging' }));
} catch (error) {
  console.error('Staging import stopped:', error.code || error.message);
  process.exitCode = 1;
} finally { await connection?.end(); }
