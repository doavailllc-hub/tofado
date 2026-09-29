import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

// Source connection is metadata-only. Never run DDL or query application rows here.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = dotenv.parse(await fs.readFile(path.join(root, 'merchant-server/.env')));
const output = path.join(root, '.staging/schema.json');
let connection;
try {
  connection = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER,
    password: env.DB_PASSWORD, database: env.DB_NAME, connectTimeout: 10000,
    ssl: { rejectUnauthorized: true, ca: await fs.readFile(path.join(root, '.staging/rds-global-bundle.pem'), 'utf8') }, multipleStatements: false,
  });
  const [[server]] = await connection.query('SELECT VERSION() AS version, @@lower_case_table_names AS lowerCaseTableNames');
  const [objects] = await connection.query('SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME');
  const tables = [];
  for (const object of objects.filter(row => row.TABLE_TYPE === 'BASE TABLE')) {
    const [[definition]] = await connection.query('SHOW CREATE TABLE ' + mysql.escapeId(object.TABLE_NAME));
    tables.push({ name: object.TABLE_NAME, ddl: definition['Create Table'].replace(/\sAUTO_INCREMENT=\d+/g, '') });
  }
  const [triggers] = await connection.query('SELECT TRIGGER_NAME FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()');
  const [routines] = await connection.query('SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE()');
  const [events] = await connection.query('SELECT EVENT_NAME FROM INFORMATION_SCHEMA.EVENTS WHERE EVENT_SCHEMA = DATABASE()');
  const snapshot = {
    format: 1, exportedAt: new Date().toISOString(), sourceVersion: server.version,
    lowerCaseTableNames: server.lowerCaseTableNames, tables,
    excluded: { views: objects.filter(row => row.TABLE_TYPE !== 'BASE TABLE').map(row => row.TABLE_NAME), triggers: triggers.map(row => row.TRIGGER_NAME), routines: routines.map(row => row.ROUTINE_NAME), events: events.map(row => row.EVENT_NAME) },
  };
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify({ exportedTables: tables.length, sourceVersion: server.version, excludedObjects: Object.fromEntries(Object.entries(snapshot.excluded).map(([key, values]) => [key, values.length])), customerRowsRead: 0, sourceMutations: 0 }));
} catch (error) {
  console.error('Schema export failed:', error.code || error.name);
  process.exitCode = 1;
} finally { await connection?.end(); }
