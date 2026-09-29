# Local staging database

The isolated MySQL 8.4.11 instance lives entirely inside `.staging/`. It listens only on **127.0.0.1:3307** and uses the database **tofado_staging**. It is a background process, not an installed Windows service.

The live `.env` was not changed. Staging has independently generated credentials in ignored local files. No customer rows are exported. Email, S3 and other production integrations are not configured for staging.

## Current state

Local staging is running with all 18 table definitions imported from production on 2026-09-06, with zero customer rows. The verified TLS export succeeded using the official AWS RDS CA bundle. Production runs MySQL 8.4.9; local staging runs 8.4.11. The auth/profile migration added `users.logo_key` locally; the required-column check now passes. Production remains unchanged.

`npm.cmd run staging:test --prefix merchant-server` runs both canonical invoice origins and payment integration checks using synthetic records and a temporary localhost HTTP listener. It verifies purchase and catalog invoice generation, guest customer snapshots, canonical payment recording, authentication, tenant isolation, concurrent idempotent submission/replay, pending-balance reservation, rejection, approval and ledger reconciliation, then removes its own records.

`npm.cmd run staging:finance --prefix merchant-server` is read-only. It reports invoice/order and payment/invoice party mismatches, invalid or overcommitted amounts, ledger drift, catalog invoice ownership issues, and missing canonical foreign keys; every count must be zero.

MySQL Workbench's saved connections use native/direct connections; no configured SSH tunnel was found. Confirm the usual VPN/network/tunnel access before retrying export. Do not broaden the database firewall to the public internet.

## Commands (from the repository root)

```powershell
npm.cmd run staging:status --prefix merchant-server
npm.cmd run staging:start --prefix merchant-server
npm.cmd run staging:stop --prefix merchant-server
```

`staging:start` refuses to start a second server if port 3307 is occupied. Status, import, stop and staging-run commands verify the actual server data directory before proceeding.

## Recreating on another Windows checkout

Do not run preparation over existing staging state. Install project dependencies first. Download `mysql-8.4.11-winx64.zip` from the official Oracle page linked below, verify its published checksum, and extract it so `.staging/runtime/mysql-8.4.11-winx64/bin/mysqld.exe` exists. Then run:

```powershell
npm.cmd run staging:prepare --prefix merchant-server
npm.cmd run staging:start --prefix merchant-server
npm.cmd run staging:status --prefix merchant-server
```

Preparation creates fresh passwords and initializes a new data directory. It refuses existing credentials or data. After the first successful status check, remove only `.staging/bootstrap.sql`; its credential setup has already been applied. This bootstrap file was already removed on the current checkout.

## Importing the production schema

Once the normal production network connection is available:

```powershell
npm.cmd run schema:export --prefix merchant-server
npm.cmd run staging:import --prefix merchant-server
npm.cmd run staging:check --prefix merchant-server
```

Before exporting on a fresh checkout, download `https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem` to `.staging/rds-global-bundle.pem`. The exporter requires this official AWS CA bundle and keeps certificate verification enabled.

The exporter runs only `SELECT` against schema/server metadata and `SHOW CREATE TABLE`, using verified TLS. It does not read application rows, lock tables, or run DDL against production. Output is `.staging/schema.json`, excluded from Git. Table auto-increment counters are removed.

The importer only creates tables on the fixed local target and refuses a non-empty database. It does not drop tables. Views, triggers, stored routines, events, non-InnoDB engines and cross-database foreign keys require review; it refuses such snapshots rather than guessing how to rewrite them. If import fails midway, partial local tables may remain; inspect them rather than retrying over existing state.

After reviewing the schema check, test the auth/profile migration only on staging:

```powershell
npm.cmd run staging:migrate --prefix merchant-server
npm.cmd run staging:check --prefix merchant-server
npm.cmd run staging:api --prefix merchant-server
```

The staging runner loads `.env.staging` explicitly and removes inherited production integration variables. The API uses port 5001. An empty database deliberately fails schema validation; do not start it as if it were production-ready.

## Workbench connection

- Connection method: Standard TCP/IP
- Host: 127.0.0.1
- Port: 3307
- Schema: tofado_staging
- Application user: tofado_stage_app
- Schema-management user: tofado_stage_admin

Read passwords locally from `merchant-server/.env.staging`; do not paste them into chat or commit them. The application user has only SELECT/INSERT/UPDATE/DELETE on staging. The schema-management user can manage only this database, plus shut down this local instance.

## Limits

- Production 8.4.9 table definitions imported successfully into local 8.4.11. Application compatibility is not yet validated, and Windows table-name case behavior may differ from Linux production.
- The schema snapshot was imported without customer data; the auth/profile migration was applied only locally.
- Real staging secrets, database files, binaries, logs and schema snapshots are ignored by Git. Regenerate them on another machine; they are not application source.
- The portable Windows distribution came from [Oracle's MySQL download page](https://dev.mysql.com/downloads/mysql/8.4.html); its published archive MD5 matched `2e833921898a9a030ea6bfe81bd811bc` over an HTTPS download. SHA-256 is recorded locally in `.staging/runtime-sha256.txt` for repeatability, not as an independently signed vendor checksum.
