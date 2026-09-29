import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLocalTarget, validateSnapshot } from '../scripts/staging-config.js';

test('staging refuses remote hosts, default production port and other databases', () => {
  const config = { host: '127.0.0.1', port: 3307, database: 'tofado_staging' };
  assert.doesNotThrow(() => assertLocalTarget(config));
  for (const change of [{ host: 'db.example.com' }, { port: 3306 }, { database: 'production' }]) assert.throws(() => assertLocalTarget({ ...config, ...change }));
});
test('schema import accepts base-table DDL but refuses external storage, qualified FKs and executable schema objects', () => {
  const snapshot = { format: 1, tables: [{ name: 'users', ddl: 'CREATE TABLE `users` (`id` bigint NOT NULL) ENGINE=InnoDB' }], excluded: {} };
  assert.doesNotThrow(() => validateSnapshot(snapshot));
  for (const ddl of ['DROP TABLE users', 'CREATE TABLE `users` (`id` bigint) ENGINE=FEDERATED CONNECTION="remote"', 'CREATE TABLE `users` (`id` bigint, FOREIGN KEY (`id`) REFERENCES `live`.`users` (`id`)) ENGINE=InnoDB']) {
    assert.throws(() => validateSnapshot({ ...snapshot, tables: [{ name: 'users', ddl }] }));
  }
  assert.throws(() => validateSnapshot({ ...snapshot, excluded: { triggers: ['example'] } }));
  assert.throws(() => validateSnapshot({ ...snapshot, tables: [...snapshot.tables, { name: 'Users', ddl: 'CREATE TABLE `Users` (`id` bigint) ENGINE=InnoDB' }] }));
});
