# Tofado Merchant

Shared B2B API, merchant web, public landing site, and retailer/wholesaler mobile applications.

Production hardening is in progress. See [PRODUCTION_READINESS_REVIEW.md](PRODUCTION_READINESS_REVIEW.md). The financial model is corrected and verified on isolated local staging; validate the production candidate with the read-only integrity check before deploying.

## Projects

- merchant-server: Express/MySQL API. src/app.js registers routes; src/index.js checks auth/profile schema and starts the process.
- merchant-client: React/Vite merchant web.
- landing: React/Vite public site.
- tofado-mobile: shared Expo/React Native source with retailer and wholesaler Android flavors.

## Development

Use Node.js 24 and npm. In PowerShell use npm.cmd if execution policy blocks npm.ps1.

1. Run npm ci, then npm run install:all.
2. Copy merchant-server/.env.example to merchant-server/.env. Configure a development database and a unique JWT_SECRET of at least 32 characters.
3. The legacy merchant-client/database/schema.sql is incomplete and includes demo data. Do not import it into production. Obtain a reviewed schema for a disposable staging database.
4. Run npm run db:check --prefix merchant-server. This reads column/foreign-key metadata only.
5. On staging first, configure separate MIGRATION_DB_* variables and run npm run db:migrate --prefix merchant-server. The migrations cover authentication/profile fields and the payment idempotency key/index; they do not rewrite financial balances.
6. Copy the web .env.example if needed, then npm run dev. API defaults to 5000, merchant web to 5173. Run the landing development server separately on another port.

## Validation

- npm test: backend security/orders, web sessions and shared mobile sessions. Database/network/storage dependencies are mocked; these are not database integration or device tests.
- npm run build: both production web builds.
- npm run db:check --prefix merchant-server: read-only metadata check.
- npm run finance:check --prefix merchant-server: read-only invoice/payment relationship and ledger reconciliation check.
- From tofado-mobile: node node_modules/expo/bin/cli export --platform android checks JS bundling.
- Native build/signing instructions: [ANDROID_BUILDS.md](tofado-mobile/ANDROID_BUILDS.md).

## Deployment gates

- NODE_ENV=production, exact HTTPS CLIENT_URL origins, non-root DB credentials and a unique JWT secret are mandatory.
- Build merchant web with the intended HTTPS VITE_API_URL, or proxy /api on the same origin. Never publish localhost configuration.
- Run migrations separately with a schema-management identity. Request handlers no longer execute DDL.
- Configure TLS, request-size/time limits and exact trusted proxy IPs at the edge.
- Application rate limits currently use per-process memory. Configure a shared limiter/gateway before running multiple instances; local counters reset on restart.
- /api/health is liveness; /api/ready checks DB connectivity. Neither certifies the complete business schema.
- Configure monitoring, alerts, backup retention, encryption, restore rehearsal and rollback. Shutdown drains requests with a 15-second deadline.
- Set real privacy/terms destinations. Contact opens an email draft; it does not claim delivery.
- `invoices` is the single ledger for both `purchase_order` and `catalog_order` origins; every payment references it. Run migrations 003/004, `finance:check`, and the complete staging acceptance workflow before release. The legacy catalog-invoice table is migration evidence only and must receive no runtime writes.

## Release workflow and operations

- `.github/workflows/release.yml` validates and packages an immutable commit-addressed artifact, deploys through protected `staging` or `production` GitHub Environments, runs approved migrations only with a recorded restore point, verifies schema/finance, performs internal and public smoke tests, and rolls code back automatically on failure.
- Production promotion requires the exact release ID accepted in staging. Configure environment reviewers, secrets and URLs before enabling the workflow.
- `.github/workflows/monitor.yml` runs five-minute public health, readiness and web-shell probes after `PRODUCTION_API_URL`, `PRODUCTION_MERCHANT_URL` and `PRODUCTION_PUBLIC_URL` repository variables are configured.
- Host service, Nginx and daily financial-integrity timer examples are under `ops/`. Provisioning, alert destinations, backup retention, restore evidence and on-call ownership are described in [the operations runbook](ops/OPERATIONS_RUNBOOK.md).

## Repository security

Mobile source is no longer ignored; generated files, keys and environments remain excluded. Review new files before committing.

The production-named PEM and release ZIP were removed from the Git index. Local copies and historical commits remain. The owner must investigate whether any credential is active/exposed and rotate it where necessary. No credential was revoked and history was not rewritten.
