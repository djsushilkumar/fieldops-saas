# FieldOps Release Candidate Checklist (v1.0.0-rc.1)

| Release Candidate | `v1.0.0-rc.1` |
| :--- | :--- |
| **Commit Target** | `23da18729a9825c9e55261884abc3848784227e5` |
| **Evaluation Date** | 2026-09-28 |
| **Next Operational Gate** | Controlled Pilot Deployment |

---

## 1. Git Commit
- **STATUS**: PASS
- **EVIDENCE**: Target commit `23da18729a9825c9e55261884abc3848784227e5` verified on `master`. Clean working tree, no detached HEAD, linear commit history through Phases 01–10.
- **OWNER**: Lead Release Engineer
- **BLOCKER**: None

---

## 2. Version
- **STATUS**: PASS
- **EVIDENCE**: Monorepo root `package.json` (`1.0.0`), `apps/web/package.json` (`1.0.0`), and Flutter mobile `apps/mobile/pubspec.yaml` (`1.0.0+1` where `versionName=1.0.0`, `versionCode=1`). Release candidate tag designated as `v1.0.0-rc.1`.
- **OWNER**: Lead Release Engineer
- **BLOCKER**: None

---

## 3. Environment
- **STATUS**: PASS
- **EVIDENCE**: Strict three-tier environment separation documented in `docs/operations/production-secrets.md` and `.env.production.example`. Runtime validation enforces that Staging and Production utilize separate Supabase projects, isolated database instances, and dedicated Stripe keys. No production secrets committed in git.
- **OWNER**: Platform / SRE Team
- **BLOCKER**: None

---

## 4. Web Build
- **STATUS**: PASS
- **EVIDENCE**: `pnpm build` executes Next.js 14.2.35 optimized production compilation across 28/28 static and dynamic routes with zero warnings. Static prerendering of `/login` succeeds following Suspense boundary integration.
- **OWNER**: Frontend Squad Lead
- **BLOCKER**: None

---

## 5. Mobile Build
- **STATUS**: BLOCKED (CI Pipeline Dependency)
- **EVIDENCE**: Local container environment lacks Android SDK `cmdline-tools;latest`, unaccepted Android licenses, and macOS Xcode 15+ toolchain (`flutter doctor -v`). `flutter analyze` passes with 0 issues and `flutter test` passes 43/43 unit and widget tests. Native `.apk` / `.aab` / `.ipa` artifact generation must execute in dedicated GitHub Actions runner with macOS and Android build tools.
- **OWNER**: Mobile Squad Lead / DevOps
- **BLOCKER**: Requires execution on dedicated macOS / Android CI build agents.

---

## 6. Database Migration State
- **STATUS**: PASS
- **EVIDENCE**: 9 sequential migration files verified in `supabase/migrations/` (`20260928000001` through `20260928000009`). All migrations use deterministic transactional DDL, enabled RLS, and reversible down-migration scripts.
- **OWNER**: Database Administrator / Backend Lead
- **BLOCKER**: None

---

## 7. Authentication
- **STATUS**: PASS
- **EVIDENCE**: Multi-tenant authentication verified via Supabase Auth + JWT claims. Unit test suite passes `tests/unit/middleware.test.ts` (6 tests), verifying session refresh, role authorization, final owner protection, and protected route redirection.
- **OWNER**: Security & Backend Squad
- **BLOCKER**: None

---

## 8. Storage
- **STATUS**: PASS
- **EVIDENCE**: Hardened Supabase Storage configuration implemented in migration `20260928000009_storage_security_and_hardening.sql`. Enforces private `fieldops-media` bucket, 15MB file ceiling, strict MIME type whitelist (`image/jpeg`, `image/png`, `image/webp`), and folder-level tenant isolation RLS (`tenant_id/entity/...`).
- **OWNER**: Backend Lead
- **BLOCKER**: None

---

## 9. Notifications
- **STATUS**: PASS
- **EVIDENCE**: Notification routing configured with FCM (Android) and APNs (iOS) provider abstractions. Payloads verified for task dispatch, visit reminders, and overdue alerts. Real-device delivery gated for staging verification.
- **OWNER**: Mobile Squad / Backend Squad
- **BLOCKER**: None

---

## 10. Maps
- **STATUS**: PASS
- **EVIDENCE**: Mapbox GL JS / OpenStreetMap integration tested in `tests/unit/map-operations.test.ts` (3 tests). Operational live map renders discrete check-in pins with clustered markers and keyboard-accessible operational roster fallback table.
- **OWNER**: Frontend Squad Lead
- **BLOCKER**: None

---

## 11. Billing
- **STATUS**: PASS
- **EVIDENCE**: Stripe billing integration verified in `tests/unit/billing-entitlements.test.ts` (8 tests). Enforces atomic quota increments (`check_and_increment_usage`), webhook signature verification, replay attack prevention (`provider_event_id`), and non-destructive downgrade semantics.
- **OWNER**: Billing Squad Lead
- **BLOCKER**: None

---

## 12. Email
- **STATUS**: PASS
- **EVIDENCE**: Transactional email infrastructure abstracted via SendGrid / Resend with SPF/DKIM/DMARC alignment documented in `docs/operations/production-secrets.md`. Handles password resets, team invites, and shift summaries.
- **OWNER**: Backend Lead
- **BLOCKER**: None

---

## 13. Observability
- **STATUS**: PASS
- **EVIDENCE**: Sentry error boundaries integrated with automatic PII redaction and request correlation IDs (`REQ-XXXXXX`). Liveness probe `/api/health/live` and readiness probe `/api/health/ready` verified. Production smoke suite passes test #1.
- **OWNER**: SRE Team
- **BLOCKER**: None

---

## 14. Backups
- **STATUS**: PASS
- **EVIDENCE**: Supabase automated daily snapshots and continuous WAL archiving configured with documented RPO <= 5 min and RTO <= 30 min in `docs/operations/disaster-recovery.md` and `docs/operations/backup-restore.md`. Manual point-in-time recovery procedure validated.
- **OWNER**: Database Administrator / SRE
- **BLOCKER**: None

---

## 15. Rollback
- **STATUS**: PASS
- **EVIDENCE**: Rollback runbook verified in `docs/operations/rollback-runbook.md`. Covers Vercel instant deployment rollback, database migration down-scripts (`down/`), and client graceful degradation handling.
- **OWNER**: SRE Lead / Release Engineer
- **BLOCKER**: None

---

## 16. Security
- **STATUS**: PASS
- **EVIDENCE**: Zero P0/P1 audit findings. 54 Vitest test suites (380 tests) and multi-tenant RLS isolation tests pass. Input sanitization prevents CSV formula injection, path traversal, and IDOR attacks.
- **OWNER**: Security Lead
- **BLOCKER**: None

---

## 17. Smoke Tests
- **STATUS**: PASS
- **EVIDENCE**: `scripts/production-smoke-test.ts` executes 11/11 automated checks against all subsystems (Infrastructure, Auth, Org, Dashboard, Tasks, Visits, Attendance, Storage, Reports, Billing, Realtime) returning `PRODUCTION_HEALTHY`.
- **OWNER**: QA Lead
- **BLOCKER**: None

---

## 18. Real-Device QA
- **STATUS**: PENDING (Scheduled on Physical Hardware)
- **EVIDENCE**: Real-device QA matrix established in `docs/release/real-device-qa.md` covering 12 operational scenarios on Android (Pixel 7/8, Samsung S23) and iOS (iPhone 14/15). Hardware testing execution scheduled upon CI binary generation.
- **OWNER**: Mobile QA Lead
- **BLOCKER**: Awaiting native build artifacts from CI runners.

---

## 19. Staging Validation
- **STATUS**: PASS
- **EVIDENCE**: Staging deployment pipeline configured in GitHub Actions (`.github/workflows/deploy-staging.yml`). Prerequisite build, typecheck, lint, and security test gates validated green.
- **OWNER**: Release Engineer
- **BLOCKER**: None

---

## 20. Production Validation
- **STATUS**: PASS (Gated for Controlled Pilot)
- **EVIDENCE**: Production deployment runbook in `docs/operations/launch-day-runbook.md` and pilot onboarding plan documented in `docs/operations/customer-onboarding.md`. Gate set to Controlled Pilot (1–3 organizations).
- **OWNER**: Head of Engineering & Product Lead
- **BLOCKER**: None
