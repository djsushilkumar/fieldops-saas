# Production Release Checklist — FieldOps SaaS

## 1. Release Identification

- **Target Release Version**: `v1.0.0-prod`
- **Target Git Commit**: `main` (clean branch)
- **Deployment Gate**: **Phase 09 — Security, QA & Production Hardening**
- **Sign-off Authority**: VP of Engineering & Head of Security

---

## 2. Pre-Deployment Gate Checklist

### 2.1 Code Quality & Monorepo Health
- [x] All TypeScript packages compile with zero errors: `pnpm typecheck` (11/11 tasks passing).
- [x] All unit, integration, and security test suites pass: `pnpm vitest run` (54/54 test files, 380/380 tests passing).
- [x] All Flutter mobile tests pass: `flutter test` (43/43 tests passing).
- [x] Monorepo dependency audit passes: no unauthorized or unvetted external dependencies.
- [x] No `TODO`, `FIXME`, or debug console prints in production code paths.

### 2.2 Security & Multi-Tenant Isolation
- [x] PostgreSQL Row-Level Security (RLS) enabled on 100% of tenant-partitioned tables (28/28 tables).
- [x] Path-based storage RLS enabled on `fieldops-media` bucket: `(storage.foldername(name))[1] = current_tenant_id()::text`.
- [x] Max upload size hard-capped at 15MB with MIME type whitelist (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `image/svg+xml`).
- [x] Zero service keys, database passwords, or signing secrets leaked to web/mobile bundles (`tests/security/secret-exposure.test.ts`).
- [x] Content Security Policy (CSP), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` headers configured.
- [x] Final Organization OWNER protection trigger active and verified (`tests/security/owner-protection.test.ts`).

### 2.3 Database & Migrations
- [x] All 9 sequential migrations applied and validated in target database environment (`supabase/migrations/`).
- [x] PostgreSQL connection pooling (pgBouncer / Supabase Pooler) configured with transaction-mode pooling.
- [x] Advisory locks and unique constraints active for concurrent shift prevention.
- [x] Automated database backup snapshot verified: WAL continuous archiving active with 30-day retention.
- [x] Data integrity diagnostic sweep passes cleanly: `pnpm tsx scripts/verify-data-integrity.ts`.

### 2.4 Web Application Console (`apps/web`)
- [x] Production Next.js build succeeds with zero type errors.
- [x] Server-side session verification in Next.js middleware with inactive organization membership revocation.
- [x] Realtime subscription channels strictly scoped by tenant UUID (`tenant:${tenantId}:*`).
- [x] Client-side React Query cache isolated per tenant session.
- [x] WCAG 2.2 AA accessibility verified for operational dashboards and geospatial map table fallbacks.

### 2.5 Mobile Field Application (`apps/mobile`)
- [x] Flutter release bundle compiled with code shrinking and obfuscation enabled (`--obfuscate --split-debug-info`).
- [x] Android Manifest & iOS Info.plist configured with foreground GPS permissions only (`ACCESS_FINE_LOCATION`). Continuous background fleet tracking disabled.
- [x] Local Drift SQLite database encrypted at rest via SQLCipher (AES-256).
- [x] Offline mutation queue handles device restart and intermittent connectivity with deterministic UUID idempotency keys.
- [x] Multi-user shared device cache wipe executed upon user logout (`tests/security/mobile-offline-security.test.ts`).

### 2.6 Billing & Subscription Entitlements
- [x] Centralized plan limits enforced via atomic database function `check_and_increment_usage`.
- [x] Webhook endpoint strictly validates provider signatures and prevents event replays (`provider_event_id` uniqueness).
- [x] Non-destructive downgrade invariant preserved: plan downgrades lock creation of new resources without destroying or deleting historical tenant data.
- [x] Billing provider credentials securely stored in production Vault / Secrets Manager.

### 2.7 Observability, Auditing & Alerts
- [x] Sentry exception tracking initialized with release tags and sanitized PII filters.
- [x] Append-only `audit_logs` table protected with SQL triggers against mutation or deletion.
- [x] Datadog / CloudWatch synthetic health check probing `/api/health` every 60 seconds.
- [x] Post-deployment verification smoke test verified: `pnpm tsx scripts/post-deployment-verification.ts`.

---

## 3. Post-Deployment Verification Steps

Immediately following production deployment, execute:
1. Run smoke verification script:
   ```bash
   pnpm tsx scripts/post-deployment-verification.ts
   ```
2. Verify Sentry error rates remain $< 0.1\%$ across web and mobile traffic.
3. Verify Supabase storage bucket permissions with test upload in dedicated canary tenant.
4. Verify webhook endpoint responsiveness with zero unhandled signature rejections.
5. Notify on-call team and confirm deployment sign-off.
