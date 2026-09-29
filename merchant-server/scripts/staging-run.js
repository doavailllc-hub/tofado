import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { root, connectStaging } from './staging-config.js';

const commands = { api: 'src/index.js', check: 'scripts/check-schema.js', finance: 'scripts/check-finance.js', migrate: 'scripts/migrate.js', test: 'scripts/staging-invoice-test.js' };
const script = commands[process.argv[2]];
if (!script) throw new Error('Use staging-run.js api, check, finance, migrate or test.');
// Check the actual server identity before permitting even the migration process to start.
const connection = await connectStaging();
await connection.end();
const envPath = path.join(root, 'merchant-server/.env.staging');
const staging = dotenv.parse(await fs.readFile(envPath));
for (const prefix of ['DB_', 'MIGRATION_DB_']) {
  if (staging[prefix + 'HOST'] !== '127.0.0.1' || staging[prefix + 'PORT'] !== '3307' || staging[prefix + 'NAME'] !== 'tofado_staging') throw new Error('Staging environment must point to the isolated local database.');
}
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(DB_|MIGRATION_DB_|AWS_|SMTP_|S3_|PLAY_REVIEW_|GOOGLE_|JWT_|CLIENT_URL$|PUBLIC_CATALOG_URL$|TRUST_PROXY$|NODE_ENV$|PORT$|DOTENV_)/.test(key)));
Object.assign(env, staging, { DOTENV_CONFIG_PATH: envPath, AWS_EC2_METADATA_DISABLED: 'true' });
const child = spawn(process.execPath, [script], { cwd: path.join(root, 'merchant-server'), env, stdio: 'inherit', windowsHide: true });
child.on('exit', code => { process.exitCode = code ?? 1; });
child.on('error', () => { console.error('Could not launch staging command.'); process.exitCode = 1; });
