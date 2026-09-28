# FieldOps — Phase 03 Test Plan: Identity, Multi-Tenancy & Access Control

---

## 1. Scope & Objectives

The Phase 03 Test Plan validates:
1. Universal 6-state authentication state machine on web and mobile.
2. Zod validation schemas for all authentication and tenant inputs.
3. API client authentication header injection, tenant header propagation, and error normalization.
4. Next.js edge middleware route guards (public, protected, tenant-dependent).
5. Web TanStack Query cache isolation upon organization switching.
6. Mobile hardware keystore integration and offline session preservation.
7. Security matrix: Cross-tenant isolation, role privilege escalation defense, final owner removal protection, and cryptographic invitation single-use redemption.

---

## 2. Test Suites Summary

| Suite Location | Target System | Tests | Status |
| :--- | :--- | :--- | :--- |
| `packages/types/tests/permissions.test.ts` | Role capabilities & `can()` evaluator | 7 | PASS |
| `packages/validation/tests/validation.test.ts` | Zod validation schemas (slugs, emails, passwords, payloads) | 20 | PASS |
| `packages/config/tests/config.test.ts` | Environment configuration & leak prevention | 6 | PASS |
| `packages/api/tests/api-client.test.ts` | API client retry policy, error normalization, header injection | 7 | PASS |
| `packages/api/tests/services.test.ts` | Phase 03 domain services (Auth, Org, Membership, Profile) | 4 | PASS |
| `apps/web/tests/unit/smoke.test.ts` | Web shell smoke test | 2 | PASS |
| `apps/web/tests/unit/middleware.test.ts` | Edge route guard middleware & tenant redirection | 6 | PASS |
| `apps/web/tests/unit/cache-isolation.test.ts` | Client query cache tenant isolation & purge | 2 | PASS |
| `tests/security/secret-exposure.test.ts` | Repository secret exposure prevention | 2 | PASS |
| `tests/security/tenant-isolation.test.ts` | Cross-tenant data isolation matrix | 2 | PASS |
| `tests/security/rbac-escalation.test.ts` | Role escalation & boundary enforcement (5 roles) | 13 | PASS |
| `tests/security/owner-protection.test.ts` | Last active Owner removal/demotion protection | 4 | PASS |
| `tests/security/membership-status.test.ts` | Suspended & removed member access denial | 4 | PASS |
| `tests/security/invitation-token.test.ts` | SHA-256 single-use expiring invitation tokens | 5 | PASS |
| `apps/mobile/test/core/failures_test.dart` | Mobile failure domain models & error mapping | 3 | PASS |
| `apps/mobile/test/features/auth/secure_storage_test.dart` | Hardware keystore read/write/clear contract | 4 | PASS |
| `apps/mobile/test/features/auth/auth_notifier_test.dart` | Riverpod AuthNotifier state transitions | 4 | PASS |
| `apps/mobile/test/features/auth/login_screen_test.dart` | Mobile LoginScreen form rendering & validation | 2 | PASS |
| `apps/mobile/test/widget_test.dart` | Mobile application mount & home shell | 1 | PASS |
