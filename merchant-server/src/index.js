import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { authColumns, registrationColumns, requireColumns } from './schema.js';
await requireColumns(pool, { ...authColumns, ...registrationColumns });
const server = app.listen(config.port, () => console.log('Tofado API listening on port ' + config.port));
server.requestTimeout = 30000;
server.headersTimeout = 15000;
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const timeout = setTimeout(() => process.exit(1), 15000);
  timeout.unref();
  server.close(async () => {
    try { await pool.end(); clearTimeout(timeout); process.exitCode = 0; }
    catch { process.exitCode = 1; }
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
