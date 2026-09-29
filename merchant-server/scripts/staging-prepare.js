import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { root, stagingDir } from './staging-config.js';

const runtime = path.join(stagingDir, 'runtime/mysql-8.4.11-winx64');
const executable = path.join(runtime, 'bin/mysqld.exe');
const envFile = path.join(root, 'merchant-server/.env.staging');
if (!fs.existsSync(executable)) throw new Error('Extract the verified official MySQL archive first. See STAGING.md.');
for (const file of [path.join(stagingDir, 'admin.json'), path.join(stagingDir, 'data'), envFile]) {
  if (fs.existsSync(file)) throw new Error('Staging state already exists; refusing to overwrite credentials or data.');
}
const secret = () => crypto.randomBytes(32).toString('hex');
const adminPassword = secret(), appPassword = secret(), rootPassword = secret();
const write = (file, value) => fs.writeFileSync(file, value, { flag: 'wx' });
write(path.join(stagingDir, 'admin.json'), JSON.stringify({ host: '127.0.0.1', port: 3307, user: 'tofado_stage_admin', password: adminPassword, database: 'tofado_staging' }, null, 2));
write(path.join(stagingDir, 'root.json'), JSON.stringify({ host: '127.0.0.1', port: 3307, user: 'root', password: rootPassword }, null, 2));
const portable = value => value.replaceAll('\\', '/');
write(path.join(stagingDir, 'mysql.ini'), `[mysqld]
basedir=${portable(runtime)}
datadir=${portable(path.join(stagingDir, 'data'))}
port=3307
bind-address=127.0.0.1
mysqlx=0
local-infile=0
secure-file-priv=NULL
event-scheduler=OFF
skip-log-bin
max-connections=30
innodb-buffer-pool-size=128M
log-error=${portable(path.join(stagingDir, 'mysql-error.log'))}
`);
write(path.join(stagingDir, 'bootstrap.sql'), `ALTER USER 'root'@'localhost' IDENTIFIED BY '${rootPassword}';
CREATE DATABASE IF NOT EXISTS tofado_staging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'tofado_stage_admin'@'127.0.0.1' IDENTIFIED BY '${adminPassword}';
CREATE USER IF NOT EXISTS 'tofado_stage_app'@'127.0.0.1' IDENTIFIED BY '${appPassword}';
GRANT ALL PRIVILEGES ON tofado_staging.* TO 'tofado_stage_admin'@'127.0.0.1';
GRANT SHUTDOWN ON *.* TO 'tofado_stage_admin'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON tofado_staging.* TO 'tofado_stage_app'@'127.0.0.1';
`);
write(envFile, `# Local staging only. No production integrations.
NODE_ENV=development
PORT=5001
CLIENT_URL=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=tofado_staging
DB_USER=tofado_stage_app
DB_PASSWORD=${appPassword}
JWT_SECRET=${secret()}
MIGRATION_DB_HOST=127.0.0.1
MIGRATION_DB_PORT=3307
MIGRATION_DB_NAME=tofado_staging
MIGRATION_DB_USER=tofado_stage_admin
MIGRATION_DB_PASSWORD=${adminPassword}
`);
const initialized = spawnSync(executable, [`--defaults-file=${path.join(stagingDir, 'mysql.ini')}`, '--initialize-insecure'], { windowsHide: true, stdio: 'ignore' });
if (initialized.error || initialized.status !== 0) throw new Error('Staging initialization failed. Inspect the local error log; partial state was preserved.');
console.log('Staging initialized without starting network listeners. Run staging:start, then staging:status.');
