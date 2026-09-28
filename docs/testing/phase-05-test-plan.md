# Phase 05 Test Plan: Field Operations, Visits & GPS Verification

## 1. Scope & Objective
Validate all capabilities of the Field Operations Engine across shared packages, database contracts, Web management console, and Flutter mobile application. Verify multi-tenant isolation, geofence radius boundary enforcement, Haversine distance mathematical precision, exception override auditing, departure check-out duration calculation, proof-of-work completeness gating, and offline mutation resilience.

---

## 2. Test Execution Matrix

| Test Suite | Location | Verification Focus | Status |
| :--- | :--- | :--- | :--- |
| **Geospatial & Visit State (Types)** | `packages/types/tests/geospatial-and-visit-state.test.ts` | 37 test cases validating Haversine distance, geofence evaluations, visit state transitions, proof completeness gating, and overdue logic. | Verified Passed |
| **Location & Visit Validation** | `packages/validation/tests/location-visit-validation.test.ts` | 56 test cases validating location coordinate boundaries, geofence radius ranges (10–50,000m), check-in/out payloads, proof formats, filter params, sort orders. | Verified Passed |
| **Location & Visit Services (API)** | `packages/api/tests/location-visit-service.test.ts` | 24 test cases covering `LocationService` and `VisitService` CRUD, check-in, checkout, proof upload, and activity timeline retrieval. | Verified Passed |
| **Web Visit Management Console** | `apps/web/tests/unit/visit-management.test.ts` | 11 test cases verifying web client state transitions, proof requirements, role authority, overdue calculation, and exception badges. | Verified Passed |
| **Mobile Geofence Service** | `apps/mobile/test/features/visits/geofence_service_test.dart` | 7 test cases covering Dart Haversine distance calculation, proximity thresholds, and arrival verification. | Verified Passed |
| **Mobile Visit Repository & Offline Queue** | `apps/mobile/test/features/visits/visit_repository_test.dart` | 5 test cases validating local cache persistence, offline mutation enqueueing (`visit.checkin`, `visit.checkout`, `visit.proof`), and idempotency keys. | Verified Passed |
| **Mobile Visits Screen UI** | `apps/mobile/test/features/visits/visits_screen_test.dart` | 4 test cases verifying Riverpod state rendering, tabbed navigation (Today, Upcoming, Completed), and status chip colors. | Verified Passed |
| **Field Visit Tenant Isolation** | `tests/security/visit-tenant-isolation.test.ts` | 4 security tests proving Tenant A cannot access Tenant B visits, record cross-tenant check-in, archive cross-tenant locations, or attach cross-tenant proofs. | Verified Passed |
| **Visit RBAC Boundaries** | `tests/security/visit-rbac-boundaries.test.ts` | 16 security tests verifying Field Worker restrictions (cannot manage locations, cannot schedule/cancel visits, cannot override geofence) and supervisor team scoping. | Verified Passed |
| **Geospatial Verification & Precision** | `tests/security/geospatial-verification.test.ts` | 14 security tests validating Haversine accuracy against real-world benchmarks, Antimeridian coordinate wrapping, accuracy degradation, and stale fix rejection. | Verified Passed |

---

## 3. Automated Validation Commands
- Monorepo Typecheck: `pnpm typecheck`
- Monorepo Test Suites: `pnpm test`
- Mobile Code Analysis: `cd apps/mobile && flutter analyze` (0 issues)
- Mobile Unit & Widget Tests: `cd apps/mobile && flutter test` (36 passed)
