import { connectStaging } from './staging-config.js';
let connection;
try {
  connection = await connectStaging();
  await connection.query('SHUTDOWN');
  console.log('Isolated staging server stopped.');
} catch (error) { console.error('Staging shutdown stopped:', error.code || error.message); process.exitCode = 1; }
finally { await connection?.end().catch(() => {}); }
