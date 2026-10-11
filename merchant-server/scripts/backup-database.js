import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createGzip } from 'node:zlib';
import 'dotenv/config';

for (const name of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
  if (!process.env[name]) throw new Error(`${name} is required.`);
}

const directory = process.argv[2];
if (!directory) throw new Error('A backup output directory is required.');
await mkdir(directory, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
const target = `${directory}/${process.env.DB_NAME}-${stamp}.sql.gz`;
const dump = spawn('mariadb-dump', [
  '--host', process.env.DB_HOST,
  '--port', String(process.env.DB_PORT || 3306),
  '--user', process.env.DB_USER,
  '--single-transaction',
  '--quick',
  '--routines',
  '--events',
  '--triggers',
  '--hex-blob',
  '--databases', process.env.DB_NAME,
], { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD }, stdio: ['ignore', 'pipe', 'inherit'] });

const output = createWriteStream(target, { mode: 0o600 });
dump.stdout.pipe(createGzip({ level: 9 })).pipe(output);
const [exitCode] = await Promise.all([new Promise((resolve, reject) => {
  dump.once('error', reject);
  dump.once('close', resolve);
}), new Promise((resolve, reject) => {
  output.once('close', resolve);
  output.once('error', reject);
})]);
if (exitCode !== 0) throw new Error(`Database backup failed with exit code ${exitCode}.`);
const details = await stat(target);
if (details.size < 100) throw new Error('Database backup is unexpectedly empty.');
console.log(JSON.stringify({ backup: target, bytes: details.size }));
