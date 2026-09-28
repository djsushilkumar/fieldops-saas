# Phase 07 — Test Plan: Web Operations Console

## 1. Test Strategy & Scope

This test plan validates the implementation of **Phase 07 — Manager/Admin Web Operations Dashboard**.
The test suite covers:
1. Operational metrics calculation (tasks today, overdue tasks, visits today, active workers, attendance ratio, exceptions).
2. Operational calendar day/week grouping, filtering, and role scoping.
3. Operational live map geofence visualization, point-in-time check-in coordinates, exception flags, and location privacy enforcement.
4. Workforce & teams management displays.
5. Worker activity ledger filtering.
6. Realtime subscription helpers and tenant-scoped query invalidation.
7. Security regression testing verifying multi-tenant isolation and RBAC authorization boundaries across all operations console screens.

---

## 2. Test Suites & Objectives

| Test Suite | File Location | Scope & Focus |
| :--- | :--- | :--- |
| **Dashboard Metrics** | `apps/web/tests/unit/dashboard-metrics.test.ts` | Unit tests for KPI calculations, overdue detection, exception thresholds. |
| **Calendar Operations** | `apps/web/tests/unit/calendar-operations.test.ts` | Day/Week grouping, date matching, role-scoped filtering. |
| **Map Operations** | `apps/web/tests/unit/map-operations.test.ts` | Geofence bounding box mapping, check-in pin categorization, exception detection, privacy verification. |
| **Realtime Updates** | `apps/web/tests/unit/realtime-operations.test.ts` | Channel naming format (`tenant:{orgId}`), query invalidation, unmount cleanup. |
| **Operations RBAC & Security** | `tests/security/web-operations-rbac.test.ts` | Tenant isolation, forbidden screen access, role boundary validation. |

---

## 3. Verification Criteria
- All 34 existing test suites must continue to pass without regression.
- New test suites must pass 100% of test cases.
- Typecheck (`pnpm typecheck`) must complete with 0 errors across the monorepo.
