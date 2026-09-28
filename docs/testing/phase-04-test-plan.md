# Phase 04 Test Plan: Task Management Engine

## 1. Scope & Objective
Validate all capabilities of the Task Management Engine across shared packages, backend contracts, Web application, and Flutter mobile application. Verify multi-tenant isolation, RBAC boundaries, state machine transitions, checklist verification rules, optimistic concurrency, and offline mutation deduplication.

---

## 2. Test Execution Matrix

| Test Suite | Location | Verification Focus | Status |
| :--- | :--- | :--- | :--- |
| **Task State Machine (Types)** | `packages/types/tests/task-state-machine.test.ts` | 14 test cases covering legal & forbidden transitions, role restrictions, checklist preconditions, blocked reasons. | Verified Passed |
| **Task Validation Schemas** | `packages/validation/tests/task-validation.test.ts` | 22 test cases validating titles, priorities, due dates, checklists, MIME whitelists, filter params, sort orders. | Verified Passed |
| **Task Domain Services (API)** | `packages/api/tests/task-service.test.ts` | 7 test cases covering `TaskService` CRUD, query string serialization, checklist operations, and offline mutation batch sync. | Verified Passed |
| **Web Task Management** | `apps/web/tests/unit/task-management.test.ts` | 8 test cases verifying web client state machine transitions, role authority checks, and overdue date calculations. | Verified Passed |
| **Mobile Task Domain & FSM** | `apps/mobile/test/features/tasks/task_models_test.dart` | 3 test groups covering Dart JSON serialization, overdue calculation, and lifecycle validation. | Verified Passed |
| **Mobile Offline Mutation Queue** | `apps/mobile/test/features/tasks/offline_queue_test.dart` | 3 test groups covering idempotency keys, state progression, and conflict detection. | Verified Passed |
| **Task Tenant Isolation** | `tests/security/task-tenant-isolation.test.ts` | 3 security tests proving Tenant A cannot access Tenant B tasks or assign cross-tenant members. | Verified Passed |
| **Task RBAC Boundaries** | `tests/security/task-rbac-boundaries.test.ts` | 10 security tests verifying Field Worker and Supervisor permission limits. | Verified Passed |
| **Offline Idempotency & OCC** | `tests/security/task-offline-idempotency.test.ts` | 2 security tests validating deduplication of replayed idempotency keys and OCC version mismatch 409 rejections. | Verified Passed |

---

## 3. Automated Validation Commands
- Monorepo Typecheck: `pnpm typecheck`
- Monorepo Test Suites: `pnpm test`
- Mobile Code Analysis: `flutter analyze` (0 issues)
- Mobile Unit & Widget Tests: `flutter test` (20 passed)
