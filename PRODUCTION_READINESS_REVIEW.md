# Tofado production readiness review

## Credential exposure investigation - 2026-09-29

- Confirmed `tofado-production-key.pem` is an RSA private key and the local file is byte-for-byte identical to Git blob `46ba5ebebbf7977bdd8a65bac51194a9e653cafc` on remote `origin/main`. It was introduced in commit `3c37d819bfd18d620ee81154901f62bf0041c867` and remains recoverable throughout later history. Public fingerprint: `SHA256:9jRl9mOeolVOKatRh6rck2jlQ8mlO7dgIDWhaABBZoA`.
- Current index removal and ignore rules prevent a normal future commit but do not revoke the credential or erase historical copies. Treat the key as compromised: replace its server/cloud authorization, verify access with the replacement, then remove the old fingerprint before any history rewrite.
- Both local mobile ZIP archives contain `.env.android`; inspection of variable names found only `EXPO_PUBLIC_API_URL`, a public client setting. The production ZIP was tracked historically and is removed from the current index; neither archive should be distributed through source control.
- Added a tracked-file secret/archive guard to local validation and CI. It rejects private-key markers, AWS access-key patterns, environment files other than examples, key stores, and release archives.
- Rotation, revocation and coordinated remote-history rewrite remain external owner actions. Do not rewrite/push history until replacement access is confirmed, all collaborators are notified, protected branches are handled, and forks/caches are considered.

## Release workflow and operational controls - 2026-09-29

- Added a manual GitHub release workflow for staging and protected production environments. It rebuilds and validates the selected commit, creates a checksummed immutable release, requires the production commit to match the accepted staging release ID, serializes deployments per environment and retains artifacts for 30 days.
- Migration execution is explicit and requires a recorded backup/PITR reference. Deployment verifies migrations, schema and financial integrity before atomic symlink activation. Local readiness and public API/web smoke tests trigger automatic code rollback; database migrations remain forward-only and must be backward compatible.
- Added hardened systemd and Nginx examples, release identity in health/readiness responses, structured production request logs, five-minute external synthetic probes, and a daily read-only financial-integrity systemd timer.
- Added an operations runbook covering environment protection, least-privilege deployment access, monitoring thresholds, logs, backups, quarterly restore rehearsals, rollback and incident handling.
- Activation remains an infrastructure gate: configure GitHub Environments/secrets/variables and reviewers, provision the host/service/proxy, connect real alert destinations, name primary/secondary on-call owners, enable backup/PITR retention, and record a successful restore rehearsal. No server, GitHub setting, monitoring provider or production database was changed by this repository work.

## Financial data model correction - 2026-09-29

- Established `invoices -> payments` as the single financial ledger. An invoice has exactly one constrained origin: `purchase_order` with a registered retailer, or `catalog_order` with customer snapshot fields and an optional retailer. Both origins use the same balances, statuses, reporting, foreign keys and payment records.
- Corrected retailer payment submission and wholesaler verification to lock and update `invoices`, matching the deployed `payments.invoice_id -> invoices.id` foreign key. Confirmed payments now reconcile `invoices.paid_amount` and `invoices.status` inside the same transaction.
- Pending payments reserve the remaining balance, cancelled invoices reject new/approved payments, payment amounts are constrained to the positive `DECIMAL(12,2)` domain, and collision-resistant payment numbers replace `MAX(id)+1` numbering.
- Added retry-safe payment submission with client-supplied idempotency keys, a per-retailer unique database index, and deterministic replay/conflict responses. The web and mobile invoice screens retain the same key across transient retry attempts.
- Removed every runtime read/write of `wholesale_catalog_invoices` and the nonexistent `wholesale_invoices`. Migration 003 copies existing catalog invoices into the canonical ledger; the legacy table remains read-only for one compatibility cycle and the integrity checker fails if any legacy row is unmigrated.
- Added a read-only financial integrity check covering party mismatches, invalid/overcommitted amounts, ledger drift, catalog invoice ownership, and canonical foreign keys.
- Local MySQL staging passed both invoice origins, catalog invoice generation, registered and guest-customer reporting, canonical payments, concurrent same-key submission, deterministic replay, conflict detection, reject/approve/reconcile and tenant isolation. All integrity and missing-constraint counts were zero. Production data was not read or changed; migrations 002 through 004 must run before deploying these routes.

## Wholesaler listing approval - 2026-09-06

- Confirmed retailer list/search and public marketplace wholesaler queries require active accounts with `verification_status='verified'`.
- Added the same account approval filter to the retailer's wholesaler connection-request list.
- Staging integration verified draft, pending and rejected businesses are absent from retailer list/search, verified businesses appear, and suspended businesses are excluded from the list. No live data or deployment changed.

## Website sign-in navigation - 2026-09-06

- Protected pages retain their path, query and anchor through sign-in. Redirect destinations are limited to the authenticated role's workspace; external URLs and traversal outside that workspace are rejected.
- Existing validated sessions skip the login form. Session restoration displays loading/retry states, and unverified wholesalers always land on their profile for onboarding.
- Google button initialization waits for session restoration and cleans up its pending script load callback.
- Eight web unit tests passed, including three redirect/onboarding tests; production build passed. Actual email delivery, Google OAuth and browser interaction remain unverified.

## Merchant website flow - 2026-09-06

- Split wholesaler navigation into purchase orders and catalog orders so both existing workflows are accessible.
- Added the missing purchase-order detail route and page; order-list clicks previously fell through to the login redirect. The page loads items, retailer and delivery information, and the associated purchase invoice, with loading, retry and empty states.
- Added an authenticated, wholesaler-scoped purchase-order detail API. Staging integration checks cover the owning wholesaler, another wholesaler, wrong role, missing authentication and invalid IDs.
- Website build and backend checks passed. Browser interaction and the complete sign-in-to-payment journey remain unverified; known financial workflow issues remain open.

## Staging fine tuning - 2026-09-06

- Applied auth/profile migration only to local staging. The missing `users.logo_key` column is now present and the required-column check passes.
- Fixed retailer invoice details to read the same `invoices` table as the invoice list, join the matching purchase-order parties, and obtain retailer contact fields from users. Fields unavailable on purchase invoices return null rather than being read from unrelated catalog invoices.
- Added a guarded staging integration command with synthetic records and cleanup. Verified list/detail consistency, paid/outstanding totals, items, unauthenticated denial, another retailer's denial, wrong-role denial, invalid IDs and suspended-user denial.
- Payment submission/verification still need their own canonical-table and transaction fixes. This batch does not certify the financial workflow or change production.

## Database access restored - 2026-09-06

- Verified TLS connection succeeded after the network access update and configuration of the official AWS RDS CA bundle in the schema exporter.
- Exported all 18 production table definitions from MySQL 8.4.9. No customer rows were read and no production changes were made.
- Imported the definitions into isolated local staging at 127.0.0.1:3307/tofado_staging (MySQL 8.4.11). No excluded views, triggers, routines or events were reported.
- Initial local schema check reports missing `users.logo_key`. Application migrations have not run; financial reconciliation and application integration tests remain outstanding.
- This update supersedes the empty-staging and connection-timeout status recorded below.

## Local staging setup ? 2026-09-06

- User confirmed the existing remote database is live production. It has not been changed.
- Installed a portable MySQL 8.4.11 instance inside ignored .staging/, bound exclusively to 127.0.0.1:3307. No Windows service or public listener was installed.
- Created the empty tofado_staging database and fresh, separate application/admin credentials. The application user has no DDL privileges. The staging environment contains no production email/storage credentials.
- Verified connectivity, data-directory identity, localhost binding, application permissions, and stop/start persistence. Staging currently contains zero tables and zero customer records.
- A metadata-only live export was attempted over verified TLS but timed out while connecting. No live schema or application rows were read and no production writes were attempted.
- Added guarded export/import and staging lifecycle commands, plus two passing safety tests. Source metadata import remains blocked on the usual live network/VPN/tunnel connection. The importer refuses non-local destinations and non-empty databases.
- Production version compatibility remains unverified; the local version is provisional until the source metadata is available.

See [STAGING.md](STAGING.md) for commands and remaining steps. Staging is running, but is not yet a schema replica.

## Environment follow-up

Checked actual environment files without printing credentials or connecting to services.

- Backend development configuration passes validation. NODE_ENV remains development.
- Removed duplicate SMTP settings, retaining the last effective values, including SMTP_PASS. This preserves behavior; SMTP delivery itself has not been tested.
- Configured GOOGLE_CLIENT_IDS from the three existing mobile/web OAuth client IDs. Merchant web now has an ignored .env.local with the matching public VITE_GOOGLE_WEB_CLIENT_ID. No API URL was changed.
- Corrected the web and mobile environment-example names to match the actual login code.
- Verified the real environment files remain ignored by Git.
- Production configuration still needs NODE_ENV=production and an HTTPS-only CLIENT_URL list; its current list includes localhost for development.
- Remote database classification is unconfirmed. No database connection or migration was attempted. MIGRATION_DB_* credentials remain unconfigured.
- iOS Google client configuration and public privacy/terms URLs are still missing. OAuth console origin/package/certificate configuration, SMTP, S3 permissions and database connectivity remain unverified.

## Implementation progress ? 2026-09-06

The first hardening batch is implemented locally. Public launch remains **on hold**. Nothing was deployed, no database migration was executed, and no credentials were rotated. The original audit below is retained as historical evidence; its backend index.js references now mostly correspond to src/app.js.

| Area | Implemented | Remaining release work |
| --- | --- | --- |
| Repository | Removed blanket mobile ignore; excluded generated files/secrets; removed production PEM and ZIP from Git index while preserving local copies; simple candidate-file guard found no private-key markers or forbidden archive/env paths in 268 files | Commit reviewed source; investigate/rotate any exposed active key; history cleanup and full secret scanning |
| Backend authorization | Verification enforced in business role guards; onboarding exception; verified/active filtering on public catalogs and discovery | Live integration tests for all tenant boundaries and suspension |
| Authentication | Mandatory strong JWT configuration; asynchronous password hashing; bounded auth/public rate limiting; OTP attempt counter capped | Shared limiter before multiple API instances; admin authentication policy; review-account isolation; refresh replay/lost-response policy |
| Reliability | All async route callbacks wrapped; centralized sanitized JSON errors/request IDs; removed duplicate API routes while preserving active contracts; bounded DB queue/uploads; DB readiness and graceful shutdown | Real DB failure/load tests, external monitoring/alerts |
| Database | Removed request-time DDL; added idempotent auth/profile migration with separate migration identity and metadata-only db:check; auth/profile schema checked before startup | Full schema reconstruction, invoice/payment reconciliation, migration/restore tests on a disposable DB |
| Web sessions | Refresh rotation, timeouts, revoked-session cleanup, offline retry gate, safe cached JSON parsing, logout revocation, stale-refresh logout protection | Multi-tab refresh coordination and full browser session/security review |
| Mobile sessions | /auth/me can refresh; transient failures preserve credentials; timeout on refresh; recovery screen; serialized token writes/version checks prevent logout-refresh resurrection | Device tests for both flavors and storage failures; full offline behavior |
| Web onboarding | Unverified wholesaler redirected to profile, actual verification badge, application submission and approval refresh | Browser/device interaction tests; verification submission still needs transactional DB review |
| Orders | Positive finite quantity/date/size validation, verified recipient lookup, collision-resistant purchase-order IDs, guarded transitions on status endpoints | Idempotency, stock/quote workflows, all alternate mutation paths and financial concurrency tests |
| Release signing | Android release requires protected upload-key environment variables; no debug release fallback | Configure each existing app's signing identity, build signed AABs, install/test on devices; iOS validation |
| Web performance | Lazy-loaded page routes; removed duplicate delivery route and malformed CSS comment | Visual regression/accessibility review; overall CSS consolidation |
| Landing | Contact opens an explicit email draft; removed placeholder phone; help routes to contact; configurable policy URLs | Country/currency decision, real approved policy URLs, support process |
| Automation | Root install/build/test scripts corrected; CI workflow added; setup and release documentation updated | Execute hosted CI after committing; expand DB/E2E/load coverage |

Validation on this checkout:

- 15 automated tests passed: 7 backend security/order tests, 5 browser-session service tests and 3 shared-mobile session service tests. Database and network dependencies are mocked.
- Merchant and landing production builds passed. Merchant entry JS is 261.33 kB (87.05 kB gzip), compared with 529.44 kB before page splitting. Pages now load separate chunks; this is an entry-bundle improvement, not a reduction of every asset combined.
- Shared Android JS export passed after using a writable Expo log destination. It is not a signed native build.
- 145 source files parsed successfully; tracked-file whitespace check passed.
- Backend dependency audit reported zero findings after a scoped qs patch; merchant web and landing production dependency audits reported zero findings.
- Mobile production dependency audit reported 18 moderate findings through decode-uri-component/query-string/navigation and uuid/xcode/Expo chains. No automatic major downgrade was applied. Inspect patched compatible releases and verify native builds before resolving these.
- In-app browser was unavailable, so no visual/interactive browser pass is claimed.
- New migration tooling and CI workflow have not been exercised against a real database or hosted runner.

Backend patch reference: [qs advisory, patched in 6.16.0](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g). The package override retains the existing Express major version.

**Next input needed:** identify a disposable local/staging MySQL database (environment or connection-variable names; do not paste passwords) and confirm the launch country/currency. India/INR is still present in business code; no currency conversion or country-specific invoice change has been applied.

The full financial/schema issue remains open. In particular, purchase-order payment paths still refer to catalog invoices inconsistently. The auth/profile migration does not solve that problem. Do not treat a passing JS build or a successful metadata check as production acceptance.

---


Review date: 2026-09-06. Decision: hold public production launch until the blockers below are resolved and staging acceptance checks pass.

## Scope and evidence limits

Reviewed repository structure, build configuration, web authentication and representative business screens, mobile authentication/navigation/storage and release configuration, backend route declarations and selected authentication, merchant, catalog, order and payment implementations, and the supplied SQL schema. Inventory: 61 merchant web JS/JSX/CSS files, 20 landing files, 80 mobile files, and 89 backend route declarations. This is a broad static readiness assessment with web build checks, not a line-by-line security certification or a completed functional test of every screen.

The retailer and wholesaler apps share `tofado-mobile`; Android flavors produce `com.tofado.app` and `com.tofado.business`. Findings in shared authentication affect both apps. iOS configuration exists, but iOS builds were not validated.

No production API requests, database migrations, deployments, credential changes, or source fixes were performed. Actual hosting controls, deployed schema, store-console settings and backups remain unverified. Secret values were not inspected. Dependency advisory auditing, device testing, browser interaction testing and load testing remain outstanding.

## Checks performed

| Check | Result |
| --- | --- |
| Merchant web `npm.cmd run build` | Passed; malformed CSS comment warning at `merchant-client/src/pages/Retailer.css:2720`; JS bundle 529.44 kB, gzip 140.30 kB; CSS 252.94 kB |
| Landing `npm.cmd run build` | Passed; JS bundle 271.78 kB, gzip 85.86 kB |
| Backend `node --check merchant-server/src/index.js` | Passed syntax check only |
| Mobile Android JS export | Blocked before bundling: filesystem EPERM opening `tofado-mobile/.expo/dev/logs/export.log`; does not establish a source compilation failure |
| Backend route inventory | Five duplicate method/path pairs found |
| Repository tracking | Mobile directory ignored; production-named PEM and mobile production ZIP tracked |

PowerShell blocked the `npm.ps1` wrapper; web checks succeeded using `npm.cmd` without changing execution policy.

## Launch blockers

### 1. Merchant verification is not enforced consistently by the API — critical

Evidence: `merchant-server/src/index.js:566` and `:677` create active wholesaler accounts with verification status `draft`. `merchant-server/src/middleware/auth.js:3` selects only id, role and status; `allow` checks role only. Business routes such as `/api/wholesaler/retailers` at `index.js:3529` use these guards. The mobile verification screen gate at `tofado-mobile/src/navigation/RootNavigator.js:71` cannot secure direct HTTP requests.

Impact: an authenticated but unverified wholesaler can reach business operations guarded only by active status and role. `/api/public/catalog/:slug` at `index.js:2229` also lacks active-account and verification filters, so a published catalog can remain visible after suspension.

Fix: enforce verified wholesaler status in shared backend business-operation middleware. Keep explicit exceptions for profile completion, verification submission and session management. Apply eligibility consistently to public catalog and marketplace queries.

Acceptance: draft, pending, rejected and suspended accounts fail protected operations and cannot appear publicly; verified accounts succeed; onboarding remains usable.

### 2. Secret management and repository recovery are unsafe — critical to investigate

`git ls-files` confirms `tofado-production-key.pem` is tracked. Its contents were inaccessible and its type, validity and exposure history were not verified. A tracked production-named key warrants immediate owner investigation. `tofado-merchant-mobile-production.zip` is also tracked and needs an inventory for embedded credentials before distribution.

Fix: identify whether the PEM is an active private credential; if so, replace/revoke it and remove it from tracking and distribution. Plan any history cleanup with repository owners. Add targeted secret/keystore/archive exclusions and automated secret scanning. Do not delete the only usable credential before arranging replacement access.

Separately, `.gitignore` excludes all of `tofado-mobile/`. A clean clone cannot reproduce either app. Track reviewed mobile source/configuration and the lockfile, while excluding secrets, generated native outputs, dependencies and caches. Do not blindly add the entire directory.

### 3. Predictable JWT fallback and insufficient abuse controls — high

`merchant-server/src/index.js:31`, `:52` and `src/middleware/auth.js:3` fall back to `dev-secret`. If deployment omits JWT_SECRET, token signatures and OTP hashes use a publicly known value. Startup currently does not fail closed.

No application-wide/IP-based rate limiter was found. Password login is unthrottled and uses synchronous scrypt, increasing resource-exhaustion exposure. Email OTP has useful per-email 60-second request spacing and a five-attempt check, but those do not bound requests across many email addresses. PLAY_REVIEW settings introduce a reusable configured OTP for one account; verify that account has isolated demonstration data.

Fix: validate required configuration before listening; require a strong secret; add bounded distributed throttling appropriate to login, email, public enquiry and upload endpoints; move password hashing off the main event loop. Check deployed gateway controls rather than assuming they exist.

### 4. Database installation is incomplete and finance references conflict — high

`merchant-client/database/schema.sql` defines six business tables but lacks current catalog, product and catalog-invoice tables and user columns such as business_category, shop_type and logo_url. Backend authentication inserts/reads these columns. Runtime schema helpers add only part of the required schema.

The supplied `payments.invoice_id` foreign key points to `invoices` (`schema.sql:106`), while retailer payment submission reads `wholesale_catalog_invoices` and inserts that invoice id into payments (`merchant-server/src/index.js:6671`). Legacy invoice/payment queries still join `invoices`. On the supplied schema this can fail or associate matching numeric IDs with the wrong invoice model. The deployed schema may differ and must be compared.

Fix: capture the actual schema without production data; choose a canonical invoice model; reconcile all writers, readers and foreign keys; create ordered, versioned migrations and separate demo seed data. Remove request-time DDL, which requires excessive runtime privileges and can race across processes.

Acceptance: a clean database and an upgraded staging copy support signup, catalog creation, ordering, invoicing, payment submission/approval and matching balances in all clients. Every payment must resolve to its intended invoice.

### 5. Duplicate routes shadow later implementations — high

All references below are in `merchant-server/src/index.js`:

| Method/path | First / second declaration |
| --- | --- |
| GET `/api/catalog/:slug` | 2340 / 2408 |
| PATCH `/api/wholesaler/catalog/orders/:id/status` | 2721 / 2819 |
| GET `/api/wholesaler/catalog/orders` | 2769 / 2866 |
| GET `/api/wholesaler/payments` | 1149 / 4768 |
| GET `/api/retailer/orders/:id` | 6143 / 6287 |

Earlier handlers that send responses prevent later handlers from running. In particular, the early payments route joins legacy invoices. Fixing only the later implementation will not change that behavior.

Fix: compare behavior and client contracts, retain one intentional implementation per path, and add a route uniqueness check plus integration coverage.

### 6. Both mobile apps lose sessions on expired-token restart — high

`tofado-mobile/src/context/AuthContext.js` restores stored credentials then calls `/auth/me`; any failure logs out and clears storage. `src/services/api.js` excludes every URL containing `/auth/` from refresh, including `/auth/me`. Tokens expire after 15 minutes. Reopening after expiry therefore clears an otherwise valid refresh session. A temporary network failure at startup also signs the user out.

The refresh call uses standalone `axios.post` without the main client's 15-second timeout. Any refresh failure clears credentials, including transient failures.

Fix: allow refresh for `/auth/me`, excluding only endpoints where refresh would recurse; bound refresh time; distinguish invalid/revoked sessions from offline/server failures. Keep protected mutations disabled when authorization cannot be established. Preserve the existing single-flight refresh and secure native token storage.

Acceptance on both flavors: reopen after token expiry; offline launch and recovery; concurrent 401s; revoked session; failed refresh response; logout/relogin. Check refresh rotation after lost network responses.

### 7. Web sessions stop working after 15 minutes — high

`merchant-client/src/context/AuthContext.jsx` saves token/user but discards refresh_token. `src/services/api.js` only injects the access token. There is no refresh or common 401 recovery. Logout clears local state without revoking the server refresh session. Restoring a session also logs out on any `/auth/me` failure.

Fix: implement a deliberate browser session design, refresh/revocation, bounded request timeouts and network-aware restoration. Review an HttpOnly-cookie session option and its CSRF requirements before choosing storage. Guard malformed stored JSON so it cannot crash application initialization.

### 8. Android release builds use the debug signing key — high

`tofado-mobile/android/app/build.gradle:132` assigns `signingConfigs.debug` to release. Both flavors inherit it. This must be replaced with protected upload signing configuration; if either application is already published, preserve the existing signing identity and follow its upload-key process.

Acceptance: independently build and verify signed AABs for both package IDs, version codes, flavor selection and Google OAuth configuration, then install/test internal releases. Android documents release preparation and developer signing requirements: [Prepare your app for release](https://developer.android.com/studio/publish/preparing?hl=en).

### 9. Async failures can escape Express error handling — high

Express 4 is declared in `merchant-server/package.json`. Multiple async routes lack try/catch, including `index.js:1141` and adjacent legacy routes. Several handlers call `await pool.getConnection()` before entering try/catch. Rejection can escape response handling and potentially terminate the process, depending on runtime behavior.

The error middleware at `index.js:1406` only handles selected logo errors and is placed before most routes; there is no final consistent JSON error handler after all routes.

Fix: wrap async handlers or consistently catch and forward failures, move connection acquisition inside protected blocks, and add final 404/error responses with request IDs and sanitized client messages. Express documents explicit async error forwarding and the different Promise behavior introduced in Express 5: [Error handling](https://expressjs.com/en/5x/guide/error-handling/).

## Additional production work

- **Order integrity:** legacy order creation at `index.js:1142` does not validate positive finite item quantities, eligible wholesaler role/status, or retailer connection. Its timestamp-suffix order number can collide. Status updates at `:1147` accept any listed status from any existing status. Centralize validation and permitted transitions; reject missing/unowned records and exercise concurrent updates.
- **Money and retries:** inspected retailer payment submission correctly uses a transaction, row locks and pending-balance checks. Preserve these protections. No idempotency-key mechanism was found; partial payment retries can still duplicate records within the remaining balance. Define monetary precision/rounding and reconcile invoice totals, confirmed payments and pending submissions.
- **Operations:** health endpoint at `index.js:328` is static; DB readiness, graceful shutdown, request tracing, centralized logging, alerts and tested restore/rollback procedures were not found in the inspected repository. Root scripts incorrectly use `client`/`server` instead of `merchant-client`/`merchant-server`; README setup paths are stale. Supply reproducible deployment instructions and a pinned runtime.
- **Configuration:** backend CORS defaults to `*`, DB user defaults to root, and web API defaults to HTTP localhost. Fail production builds/startup on missing configuration and explicitly scope origins/DB permissions. The supplied landing nginx config only shows port 80; actual TLS termination must be verified at the deployment edge.
- **Landing functionality:** `landing/src/pages/Contact.jsx:7` only sets local success state; no enquiry is delivered. Phone is placeholder text. Footer privacy link points to `#privacy`. Complete contact delivery and publish real policy/support destinations before advertising the service.
- **Market consistency:** landing contact content targets Saudi Arabia/GCC while web/backend money text uses INR and en-IN. Confirm launch country, currency and invoice requirements before changing arithmetic or documents. This report does not assess jurisdictional compliance.
- **Web maintainability/performance:** fix `Retailer.css:2720`, add route-level splitting, and consolidate overlapping CSS only with visual checks. `merchant-client/src/routes/profileRoutes.js` contains server-only Express/S3 code with missing relative imports and appears misplaced; verify references before removing it.
- **Coverage:** no test/CI scripts were found in reviewed package manifests. Add integration tests for authorization, data isolation, invoice consistency and retries; staging end-to-end tests for each role/client; and dependency/secret checks. Store account deletion/privacy flows and mobile accessibility/device behavior still need explicit review.

## Recommended implementation sequence and release gates

1. **Secure and preserve source:** investigate tracked key; inventory archive; safely version mobile source; correct root scripts and environment templates. Gate: clean clone can install all projects without credentials committed.
2. **Make the backend trustworthy:** reconcile schema/invoices, eliminate duplicate routes, enforce verification, close async error gaps, add startup validation and abuse controls. Gate: clean-install and upgrade migrations pass; negative authorization and payment-concurrency tests pass.
3. **Fix sessions and core flows:** implement web refresh and mobile restart/offline behavior. Gate: retailer creates order, wholesaler processes it, invoice/payment balances agree in web and both apps, including after retries and app restarts.
4. **Prepare release infrastructure:** configure signing, staging, CI, readiness, alerts, backup restoration and rollback. Gate: both signed AABs pass device tests and web routes/assets work behind intended TLS/proxy configuration.
5. **Run a controlled merchant pilot:** use representative catalog sizes and simultaneous merchants; check cross-account access, suspension, failed uploads, cancelled orders, partial payments and network interruptions. Gate: no unresolved critical/high findings, reconciled financial data and a successful restore rehearsal before public launch.

Architecture recommendation: keep the shared mobile codebase and shared API. Split the large backend into authentication, merchants, catalog, orders, invoices/payments and administration modules incrementally after behavior is covered. These findings do not justify a wholesale rewrite.
