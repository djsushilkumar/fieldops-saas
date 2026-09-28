# Production Regression Test Matrix — FieldOps SaaS

## 1. Domain Coverage Matrix

This matrix maps all core FieldOps operational domains across tiers (Web, Mobile, API, Database) to their automated regression test suites, frequency, and verification targets.

| Domain # | Product Domain | Web Console Tests | Mobile App Tests | API & Validation Tests | Database & RLS Tests | Security & Hardening Tests | Execution Frequency |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | **Identity, Auth & Multi-Tenancy** | `middleware.test.ts`, `smoke.test.ts` | `auth_screen_test.dart` | `api-client.test.ts` | `000001_initial_schema.sql` | `tenant-isolation.test.ts`, `membership-status.test.ts` | Every PR / Merge |
| **02** | **RBAC & Final Owner Protection** | `web-operations-rbac.test.ts` | `role_gate_test.dart` | `permissions.test.ts` | `000002_rbac_policies.sql` | `rbac-escalation.test.ts`, `owner-protection.test.ts` | Every PR / Merge |
| **03** | **Task Engine & State Machine** | `task-management.test.ts` | `task_list_test.dart`, `task_detail_test.dart` | `task-service.test.ts`, `task-validation.test.ts` | `000003_tasks_schema.sql` | `task-rbac-boundaries.test.ts`, `task-tenant-isolation.test.ts` | Every PR / Merge |
| **04** | **Geospatial & Geofence Verification**| `map-operations.test.ts` | `geofence_checker_test.dart` | `location-visit-service.test.ts`, `location-visit-validation.test.ts` | `000004_visits_geofences.sql`| `geospatial-verification.test.ts`, `input-validation-injection.test.ts` | Every PR / Merge |
| **05** | **Field Visits & Proof of Work** | `visit-management.test.ts` | `visit_screen_test.dart`, `proof_capture_test.dart` | `location-visit-service.test.ts` | `000004_visits_geofences.sql`| `visit-rbac-boundaries.test.ts`, `visit-tenant-isolation.test.ts` | Every PR / Merge |
| **06** | **Attendance, Shifts & Ledger** | `attendance-management.test.ts` | `duty_timer_test.dart`, `shift_screen_test.dart` | `attendance-service.test.ts`, `attendance-validation.test.ts` | `000005_attendance_shifts.sql`| `attendance-tenant-isolation.test.ts`, `attendance-rbac-boundaries.test.ts`| Every PR / Merge |
| **07** | **Operations Dashboard & Live Map** | `dashboard-metrics.test.ts`, `calendar-operations.test.ts` | N/A (Web only) | `services.test.ts` | `000006_dashboard_views.sql` | `web-operations-rbac.test.ts`, `realtime-operations.test.ts` | Every PR / Merge |
| **08** | **Reporting & RFC 4180 CSV Export** | `report-generation.test.ts` | N/A (Web only) | `report-service.test.ts` | `000007_reporting_views.sql` | `reporting-tenant-isolation.test.ts`, `e2e-golden-path.test.ts` | Every PR / Merge |
| **09** | **SaaS Billing & Entitlements** | `billing-entitlements.test.ts` | N/A (Web only) | `billing-service.test.ts` | `000008_billing_schema.sql` | `billing-tenant-isolation.test.ts`, `billing-webhook-security.test.ts` | Every PR / Merge |
| **10** | **Offline Sync & Storage Security** | `cache-isolation.test.ts` | `drift_sync_queue_test.dart`, `offline_queue_test.dart` | `api-client.test.ts` | `000009_storage_security_and_hardening.sql` | `storage-file-upload-security.test.ts`, `mobile-offline-security.test.ts` | Every PR / Merge |

---

## 2. Test Suite Categorization & Statistics

| Suite Category | Framework / Tool | Test Files | Total Tests | Pass Rate | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Unit & Service Tests** | Vitest | 23 | 178 | 100% | **PASS** |
| **Validation & Schema Tests** | Vitest (Zod) | 4 | 67 | 100% | **PASS** |
| **Web Console UI & Mock Tests** | Vitest (React Testing Lib) | 10 | 67 | 100% | **PASS** |
| **Security, IDOR & Isolation Tests** | Vitest | 17 | 68 | 100% | **PASS** |
| **Mobile Client Widget & Logic** | Flutter Test | 11 | 43 | 100% | **PASS** |
| **Type Integrity & Static Analysis** | Turbo / TypeScript (`tsc`) | 7 pkgs | 11 tasks | 100% | **PASS** |
| **Data Integrity Diagnostic Sweep** | TypeScript CLI (`scripts/`) | 1 | 4 suites | 100% | **PASS** |
| **TOTAL** | — | **66 files** | **427 tests** | **100%** | **GREEN** |

---

## 3. Negative Testing & Boundary Enforcement

The regression suite specifically validates adversarial and failure edge cases:
- **Tenant ID Injection**: Requesting another tenant's tasks, visits, attendance records, or locations returns empty sets (HTTP 404 / 403).
- **Payload Fuzzing**: Payloads exceeding 100KB are terminated early.
- **Malformed Enums & Coordinates**: Rejecting latitude $> 90^\circ$ or $<-90^\circ$, longitude $> 180^\circ$ or $<-180^\circ$, geofence radius $< 10\text{m}$ or $> 50,000\text{m}$.
- **Storage Injection**: Rejecting null-byte filenames (`photo.png\0.exe`), path traversals (`../../etc/passwd`), unapproved extensions (`.sh`, `.exe`, `.bat`), and files exceeding 15MB.
- **Race Conditions**: Preventing concurrent active shift clock-ins via database transactional locking.
- **Owner Demotion**: Preventing self-demotion or removal of the last remaining organization Owner.
