import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const stagingDir = path.join(root, '.staging');
export const stagingDatabase = 'tofado_staging';
export function assertLocalTarget(config) {
  if (config.host !== '127.0.0.1' || config.port !== 3307 || config.database !== stagingDatabase) {
    throw new Error('Staging requires the fixed local target 127.0.0.1:3307/tofado_staging.');
  }
}
export async function connectStaging() {
  const config = JSON.parse(await fs.readFile(path.join(stagingDir, 'admin.json'), 'utf8'));
  assertLocalTarget(config);
  const connection = await mysql.createConnection({ ...config, multipleStatements: false, connectTimeout: 5000 });
  try {
    const [[server]] = await connection.query('SELECT @@datadir AS dataDir');
    const expected = path.resolve(stagingDir, 'data').toLowerCase();
    if (path.resolve(server.dataDir).toLowerCase() !== expected) throw new Error('Server data directory is not the isolated workspace staging directory.');
    return connection;
  } catch (error) { await connection.end(); throw error; }
}

export function validateSnapshot(snapshot) {
  if (snapshot.format !== 1 || !Array.isArray(snapshot.tables) || !snapshot.tables.length) throw new Error('A non-empty schema-only JSON snapshot is required.');
  const names = new Set();
  for (const table of snapshot.tables) {
    if (typeof table.name !== 'string' || !/^[a-zA-Z0-9_]+$/.test(table.name)) throw new Error('Unsupported table identifier.');
    if (names.has(table.name.toLowerCase())) throw new Error('Table names collide on Windows.');
    names.add(table.name.toLowerCase());
    if (typeof table.ddl !== 'string' || !table.ddl.startsWith('CREATE TABLE ' + mysql.escapeId(table.name) + ' (')) throw new Error('Snapshot must contain SHOW CREATE TABLE definitions only.');
    if (!/ENGINE=InnoDB\b/i.test(table.ddl) || /\b(?:DATA DIRECTORY|INDEX DIRECTORY|TABLESPACE|CONNECTION\s*=)/i.test(table.ddl)) throw new Error('Only self-contained InnoDB table definitions are supported.');
    if (/REFERENCES\s+`[^`]+`\s*\./i.test(table.ddl)) throw new Error('Cross-database foreign keys require manual review.');
  }
  if (Object.values(snapshot.excluded || {}).some(objects => objects.length)) throw new Error('Views, triggers, routines or events exist and require explicit staging review before import.');
}
