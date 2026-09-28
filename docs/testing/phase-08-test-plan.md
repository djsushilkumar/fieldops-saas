# Phase 08 — Test Plan: Reports, Exports, Usage Metering & SaaS Billing

## 1. Test Strategy & Scope

This test plan validates the implementation of **Phase 08 — Reports + SaaS Billing**.
The test suite covers:

1. **Operational Reporting & CSV Generation**:
   - RFC 4180 CSV generation, formula sanitization (`=`, `+`, `-`, `@`), and UTF-8 Byte Order Mark (`\uFEFF`) inclusion.
   - Bounded row limit enforcement (5,000 maximum rows).
   - KPI summary calculations for Tasks, Visits, Attendance, and Workforce activity.
   - Zero division-by-zero resilience on empty datasets.
   - Data minimization compliance (excluding raw latitude/longitude in favor of discrete `LocationVerificationResult` status).
   - Objective workforce reporting with zero competitive rankings or toxic gamification.

2. **SaaS Billing & Subscriptions**:
   - Subscription plan configurations (`FREE`, `STARTER`, `GROWTH`, `BUSINESS`) with quota matrices (`maxWorkers`, `maxLocations`, `maxMonthlyVisits`, `maxMonthlyExports`).
   - Pure entitlement helpers (`isSubscriptionEntitled`, `isWithinGracePeriod`, `getPlanEntitlements`).
   - Mock billing provider abstraction (`createCustomer`, `createCheckoutSession`, `createPortalSession`, `cancelSubscription`).
   - Client billing services and usage check APIs.

3. **Security, Tenant Isolation & Idempotency**:
   - Cross-tenant isolation across billing accounts, subscriptions, usage counters, and reports.
   - RBAC boundaries: `OWNER` manages billing, `ADMIN` views billing read-only, other roles forbidden.
   - Report permissions: `REPORT_VIEW` for supervisors+, `REPORT_EXPORT` for managers+.
   - Webhook signature verification and deterministic replay protection via unique `provider_event_id` in `billing_events`.
   - Atomic quota check and non-destructive downgrade invariance.

---

## 2. Test Suites & Objectives

| Test Suite | File Location | Scope & Focus |
| :--- | :--- | :--- |
| **Report Generation & CSV** | `apps/web/tests/unit/report-generation.test.ts` | Unit tests for RFC 4180 formatting, formula escaping, 5,000 row limits, KPI formulas, and reporting RBAC. |
| **Billing & Entitlements** | `apps/web/tests/unit/billing-entitlements.test.ts` | Unit tests for plan configs, entitlement quotas, past-due grace period logic, and billing role governance. |
| **Report Service** | `packages/api/tests/report-service.test.ts` | API client tests for reporting endpoints, audit log posting, and CSV formatting without GPS coordinates. |
| **Billing Service** | `packages/api/tests/billing-service.test.ts` | API client and MockBillingProvider tests for customer creation, checkout sessions, and portal sessions. |
| **Billing Tenant Isolation** | `tests/security/billing-tenant-isolation.test.ts` | Security test ensuring billing endpoints reject cross-tenant requests and unauthorized roles. |
| **Reporting Tenant Isolation** | `tests/security/reporting-tenant-isolation.test.ts` | Security test ensuring report queries and audit logs enforce strict tenant partitioning. |
| **Billing Webhooks & Idempotency** | `tests/security/billing-webhook-security.test.ts` | Security test validating webhook signature verification and duplicate event rejection. |
| **Plan Limits & Downgrade Invariance** | `tests/security/plan-limits.test.ts` | Security test verifying atomic usage checks, plan quota enforcement, and non-destructive downgrade invariance. |

---

## 3. Verification Criteria

- All 47 test files across packages and web must pass 100%.
- Flutter mobile test suite must pass with 0 regressions.
- Typecheck (`pnpm typecheck`) must complete with 0 errors across all 7 packages.
- Zero mock payment charges in tests.
