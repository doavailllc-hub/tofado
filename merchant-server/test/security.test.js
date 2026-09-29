import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = 'http://localhost:5173';
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const { validateConfig } = await import('../src/config.js');
const { hashPassword, verifyPassword } = await import('../src/utils/password.js');
const { allow, allowOnboarding } = await import('../src/middleware/auth.js');

test('production rejects missing secret, wildcard origins and root database users', () => {
  assert.throws(() => validateConfig({}), /JWT_SECRET/);
  const env = { JWT_SECRET: process.env.JWT_SECRET, NODE_ENV: 'production', CLIENT_URL: 'https://merchant.example.com', DB_HOST: 'db', DB_USER: 'merchant', DB_PASSWORD: 'test', DB_NAME: 'merchant' };
  assert.equal(validateConfig(env).production, true);
  assert.throws(() => validateConfig({ ...env, CLIENT_URL: '*' }));
  assert.throws(() => validateConfig({ ...env, DB_USER: 'root' }));
  assert.throws(() => validateConfig({ ...env, CLIENT_URL: 'http://merchant.example.com' }));
});
test('verification guard blocks every unapproved status, preserves onboarding and other roles', () => {
  for (const verification_status of ['draft', 'pending', 'rejected', undefined]) {
    let status, passed = false;
    const res = { status(value) { status = value; return this; }, json() {} };
    allow('wholesaler')({ user: { role: 'wholesaler', verification_status } }, res, () => { passed = true; });
    assert.equal(status, 403); assert.equal(passed, false);
    allowOnboarding({ user: { role: 'wholesaler', verification_status } }, res, () => { passed = true; });
    assert.equal(passed, true);
  }
  for (const role of ['retailer', 'admin', 'wholesaler']) {
    let passed = false;
    allow(role)({ user: { role, verification_status: 'verified' } }, {}, () => { passed = true; });
    assert.equal(passed, true);
  }
});
test('password hashes remain compatible and reject malformed or oversized input', async () => {
  const hash = await hashPassword('Correct password');
  assert.equal(await verifyPassword('Correct password', hash), true);
  assert.equal(await verifyPassword('Wrong password', hash), false);
  assert.equal(await verifyPassword('x', 'invalid'), false);
  assert.equal(await verifyPassword('x'.repeat(1025), hash), false);
});
test('every API method/path is registered once', () => {
  const seen = new Set();
  for (const layer of app._router.stack) {
    if (!layer.route) continue;
    for (const method of Object.keys(layer.route.methods)) {
      const key = method + ' ' + layer.route.path;
      assert.equal(seen.has(key), false, key);
      seen.add(key);
    }
  }
});
test('API catches unavailable DB, sanitizes errors, handles malformed JSON and blocks draft users', async t => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const originalQuery = pool.query;
  const originalGetConnection = pool.getConnection;
  t.after(async () => { pool.query = originalQuery; pool.getConnection = originalGetConnection; await new Promise(resolve => server.close(resolve)); });
  const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
  const headers = { Authorization: 'Bearer ' + token };
  pool.query = async () => { throw Object.assign(new Error('SECRET SQL AND PASSWORD'), { code: 'DB_DOWN' }); };
  let response = await fetch(base + '/api/retailer/orders', { headers });
  assert.equal(response.status, 500);
  let body = await response.text();
  assert.equal(body.includes('SECRET'), false);
  assert.equal(response.headers.has('x-request-id'), true);
  pool.query = async () => [[{ id: 1, role: 'wholesaler', status: 'active', verification_status: 'draft' }]];
  response = await fetch(base + '/api/wholesaler/orders', { headers });
  assert.equal(response.status, 403);
  response = await fetch(base + '/api/auth/email/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(response.status, 400);
  response = await fetch(base + '/api/missing');
  assert.equal(response.status, 404);
  pool.query = async () => [[{ id: 1, role: 'retailer', status: 'active' }]];
  pool.getConnection = async () => { throw new Error('connection failed before try'); };
  response = await fetch(base + '/api/retailer/orders', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ wholesaler_id: 2, delivery_address: 'Shop', items: [{ product_name: 'Rice', quantity: 1, unit: 'kg' }] }) });
  assert.equal(response.status, 500);
  assert.equal((await response.text()).includes('connection failed'), false);
  response = await fetch(base + '/api/health');
  assert.equal(response.status, 200);
});
