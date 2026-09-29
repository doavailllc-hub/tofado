# Tofado release and operations runbook

## Release model

Every deployment is an immutable tarball identified by the first 12 characters of its Git commit. GitHub Actions validates, builds and checksums it. The selected GitHub Environment supplies deployment secrets and URLs. Configure `production` with required reviewers and prevent self-review; keep `staging` automatic or use a separate reviewer.

Required environment secrets:

- `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`
- `DEPLOY_KNOWN_HOSTS`: the pinned `ssh-keyscan` output verified through a trusted channel

Required environment variables:

- `API_URL`, `MERCHANT_APP_URL`, `PUBLIC_URL`
- `PRIVACY_URL`, `TERMS_URL`

Server layout:

- `/opt/tofado/releases/<release-id>` immutable releases
- `/opt/tofado/current` active symlink
- `/opt/tofado/shared/server.env` mode 600, owned by the service account
- `/opt/tofado/incoming` uploaded artifacts
- `/opt/tofado/bin` deployment scripts

The deploy user needs narrowly scoped passwordless sudo only for `systemctl restart tofado-api`. It must not have general root access. Install [tofado-api.service](systemd/tofado-api.service) and adapt [the Nginx example](nginx/tofado.conf.example) once during host provisioning.

## Promotion procedure

1. Merge only after `Validate` passes.
2. Run `Release` for `staging`, enabling migrations only when the release contains reviewed forward-compatible migrations.
3. Record the database snapshot/PITR restore-point identifier in `backup_reference` when migrations are enabled.
4. Complete role-based acceptance tests in staging. Record the release ID and evidence.
5. Run `Release` for `production` on the same commit and enter the staging release ID. The workflow refuses a different commit. A production environment reviewer checks the staging evidence, restore point, migration compatibility and incident coverage before approval.
6. The workflow verifies the checksum, migrations, schema, financial ledger, local readiness, public API release identity and both web shells.

Migrations are forward-only. Code rollback is automatic, but schema rollback is deliberately not automatic. Every migration must remain compatible with the previous application release. Destructive migrations require a separate expand/migrate/contract release series.

## Rollback

Failed local activation restores the prior symlink automatically. Failed public smoke checks invoke `/opt/tofado/bin/rollback.sh`. For a manual rollback:

```bash
/opt/tofado/bin/rollback.sh
```

Then confirm `/api/ready`, merchant login, public landing, authentication, and the latest invoice/payment reads. If a migration caused data damage, stop writes and use the documented database restore process; do not improvise reverse SQL.

## Monitoring and alert thresholds

Collect Nginx access/error logs, `journalctl -u tofado-api`, host CPU/memory/disk, MySQL connections/latency/storage, and external HTTPS probes. Logs must be shipped off-host and retained for at least 30 days with secrets and authorization headers redacted.

Page the on-call owner for:

- readiness unavailable for 2 consecutive minutes;
- 5xx responses above 2% for 5 minutes or payment endpoints returning any sustained 5xx;
- p95 API latency above 2 seconds for 10 minutes;
- database connection saturation above 80%, storage below 20%, or replication/PITR failure;
- disk above 80%, certificate expiry below 21 days, backup failure, or financial integrity count above zero.

Create a daily scheduled read-only `finance:check` job. A nonzero count blocks deployments and pages the service owner. Synthetic monitoring should exercise health, readiness, login-page delivery and one read-only authenticated tenant-isolation check using a dedicated nonproduction account.

## Backups and restore

Enable encrypted database automated backups and point-in-time recovery with retention matching business requirements. Keep backups in a different failure domain/account where supported. Before a migration, create and record a restore point. Quarterly, restore into an isolated database, run `db:check`, `finance:check`, and the staging acceptance suite, then record recovery time and recovery point achieved. A backup is not accepted until a restore rehearsal succeeds.

S3 object versioning/lifecycle protection must cover uploaded business assets. Back up `/opt/tofado/shared/server.env` only into the approved encrypted secret manager; never into release artifacts.

## Incident procedure

1. Declare severity and incident owner; preserve timestamps and release ID.
2. Stop deployment concurrency. For suspected financial corruption, disable financial writes before investigation.
3. Roll back code if the current release caused the incident. Do not reverse a schema migration without an approved recovery plan.
4. Capture sanitized logs, metrics, database integrity output and affected request IDs.
5. Communicate status on the agreed cadence and document customer impact.
6. Restore service, reconcile financial records, and complete a blameless review with owned follow-ups.

Operational readiness is complete only after real alert destinations, named primary/secondary on-call owners, production environment reviewers, backup retention, and a successful restore rehearsal are recorded outside the repository.
