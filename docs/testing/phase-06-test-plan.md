# Phase 06 Test Plan: Mobile Workforce, Attendance & Shift Tracking

## 1. Scope & Objective
Validate all capabilities of the Mobile Workforce, Attendance & Shift Tracking engine across database contracts, shared monorepo packages, Web management console, Flutter mobile application, and Security suites. Verify shift exclusivity, point-in-time GPS fix recording, duty duration computation, audited manual attendance adjustments, offline mutation queueing, and cross-tenant isolation.

---

## 2. Test Execution Matrix

| Test Suite | Location | Verification Focus | Status |
| :--- | :--- | :--- | :--- |
| **Attendance Lifecycle & Domain (Types)** | `packages/types/tests/attendance-lifecycle.test.ts` | 12 test cases validating attendance state transitions, shift duration seconds calculation, formatting, and worker activity types. | Verified Passed |
| **Attendance Validation Schemas** | `packages/validation/tests/attendance-validation.test.ts` | 11 test cases validating clock-in/out payloads, coordinate ranges, accuracy bounds, adjustment reasons ($\ge 10$ chars), and date filters. | Verified Passed |
| **Attendance Service (API)** | `packages/api/tests/attendance-service.test.ts` | 6 test cases verifying `AttendanceService` clock-in, clock-out, active shift retrieval, audited manual adjustments, and worker activity listings. | Verified Passed |
| **Web Attendance Management Console** | `apps/web/tests/unit/attendance-management.test.ts` | 11 test cases verifying RBAC permissions (`ATTENDANCE_CLOCK_OWN`, `ATTENDANCE_VIEW_ORG`, `ATTENDANCE_ADJUST`), adjustment validation, and duration formatting. | Verified Passed |
| **Mobile Attendance Repository** | `apps/mobile/test/features/attendance/attendance_repository_test.dart` | 5 test cases validating local cache persistence, active shift tracking, offline mutation enqueueing (`attendance.clock_in`, `attendance.clock_out`), and duplicate shift blocking. | Verified Passed |
| **Mobile Attendance Widgets** | `apps/mobile/test/features/attendance/attendance_screen_test.dart` | 2 widget test cases verifying `AttendanceCard` duty status and `AttendanceScreen` shift history rendering. | Verified Passed |
| **Attendance Tenant Isolation** | `tests/security/attendance-tenant-isolation.test.ts` | 3 security test cases proving Tenant A cannot view Tenant B attendance, adjust Tenant B records, or access cross-tenant worker activities. | Verified Passed |
| **Attendance RBAC & Audit Boundaries** | `tests/security/attendance-rbac-boundaries.test.ts` | 7 security test cases verifying Field Worker and Supervisor adjustment restrictions, Manager authorization, 10-character reason enforcement, and immutable audit logging. | Verified Passed |

---

## 3. Automated Verification Commands
- Monorepo Typecheck: `pnpm typecheck` (11 tasks successful, 0 errors)
- Full Monorepo Vitest Suite: `pnpm vitest run` (34 test files passed, 281 tests passed)
- Mobile Static Analysis: `flutter analyze` (0 issues)
- Mobile Test Suite: `flutter test` (43 passed)
