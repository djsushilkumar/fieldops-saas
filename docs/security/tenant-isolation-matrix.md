# FieldOps Multi-Tenant Isolation Matrix

## 1. Governance & Tenancy Model

FieldOps enforces a strict **Shared-Process, Shared-Database, Row-Level Partitioned Multi-Tenancy Architecture** (ADR-0005 & ADR-0013).
Every tenant-scoped record belongs to exactly one `organization_id`. Tenant isolation is enforced authoritative at the PostgreSQL engine level via Row-Level Security (RLS) evaluated against `public.current_tenant_id()`.

---

## 2. Comprehensive Domain Tenant Isolation Inventory

| Resource / Table | Owner / Parent Entity | Tenant Relationship Column | PostgreSQL RLS Policy | Server Authorization Rule | Client Access | Automated Test Suite |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Organizations** | Root Entity | `id` | `tenant_isolation_organizations` | Active Membership in Tenant | Web / Mobile Shell | `tests/security/tenant-isolation.test.ts` |
| **Profiles** | User Account | Auth UID (`id`) | `profiles_select_policy` | Current User UID | Web / Mobile Profile | `tests/security/tenant-isolation.test.ts` |
| **Memberships** | Organization | `organization_id` | `tenant_isolation_memberships` | Active Membership in Org | Web / Mobile | `tests/security/membership-status.test.ts` |
| **Invitations** | Organization | `organization_id` | `tenant_invitations_policy` | Owner / Admin Role | Web Admin | `tests/security/invitation-token.test.ts` |
| **Audit Logs** | Organization | `organization_id` | `tenant_isolation_audit_logs` | Immutable Trigger Protection | Web Owner/Admin | `tests/security/tenant-isolation.test.ts` |
| **Teams** | Organization | `organization_id` | `tenant_isolation_teams` | Manager / Admin / Owner | Web Management | `tests/security/web-operations-rbac.test.ts` |
| **Team Members** | Team | `organization_id` (via team) | `tenant_isolation_team_members`| Supervisor+ | Web Management | `tests/security/web-operations-rbac.test.ts` |
| **Tasks** | Organization | `organization_id` | `tenant_isolation_tasks_select` | Role & Assignment Scoped | Web Console / Mobile | `tests/security/task-tenant-isolation.test.ts` |
| **Task Checklists** | Task | `organization_id` (via task) | `tenant_isolation_checklists` | Assigned Worker or Supervisor+ | Web / Mobile | `tests/security/task-rbac-boundaries.test.ts` |
| **Task Attachments** | Task | `organization_id` (via task) | `tenant_isolation_attachments` | Assigned Worker or Supervisor+ | Web / Mobile | `tests/security/task-tenant-isolation.test.ts` |
| **Task Comments** | Task | `organization_id` (via task) | `tenant_isolation_comments` | Assigned Worker or Supervisor+ | Web / Mobile | `tests/security/task-tenant-isolation.test.ts` |
| **Task Activities** | Task | `organization_id` (via task) | `tenant_isolation_activities` | Read-only Audit Feed | Web / Mobile | `tests/security/task-tenant-isolation.test.ts` |
| **Offline Mutations** | Mobile Device | `organization_id` | `tenant_isolation_offline_mutations` | Authenticated Worker Session | Mobile Sync Engine | `tests/security/task-offline-idempotency.test.ts` |
| **Customer Locations** | Organization | `organization_id` | `p_locations_tenant` | Supervisor+ (Mobile: Assigned)| Web / Mobile | `tests/security/visit-tenant-isolation.test.ts` |
| **Field Visits** | Organization | `organization_id` | `p_visits_tenant` | Assigned Worker or Supervisor+ | Web / Mobile | `tests/security/visit-tenant-isolation.test.ts` |
| **Visit Check-ins** | Visit | `organization_id` | `p_checkins_tenant` | Assigned Worker (Haversine verified)| Web / Mobile | `tests/security/geospatial-verification.test.ts` |
| **Visit Check-outs** | Visit | `organization_id` | `p_checkouts_tenant` | Assigned Worker | Web / Mobile | `tests/security/visit-rbac-boundaries.test.ts` |
| **Visit Proofs** | Visit | `organization_id` | `p_proofs_tenant` | Assigned Worker or Supervisor+ | Web / Mobile | `tests/security/storage-file-upload-security.test.ts` |
| **Visit Activities** | Visit | `organization_id` | `p_visit_activities_tenant` | Immutable Activity Feed | Web / Mobile | `tests/security/visit-tenant-isolation.test.ts` |
| **Location Events** | Organization | `organization_id` | `p_location_events_tenant` | Supervisor+ | Web Map / Activity | `tests/security/visit-tenant-isolation.test.ts` |
| **Attendance Records** | Organization | `organization_id` | `attendance_records_tenant_isolation`| Worker (Own) / Supervisor+ (Team) | Web Attendance / Mobile | `tests/security/attendance-tenant-isolation.test.ts` |
| **Worker Activities** | Organization | `organization_id` | `worker_activities_tenant_isolation` | Worker (Own) / Supervisor+ (Team) | Web Activity / Mobile | `tests/security/attendance-tenant-isolation.test.ts` |
| **Billing Accounts** | Organization | `organization_id` | `billing_accounts_tenant_isolation` | Owner / Admin Read; Owner Modify | Web Billing Settings | `tests/security/billing-tenant-isolation.test.ts` |
| **Subscriptions** | Organization | `organization_id` | `subscriptions_tenant_isolation` | Owner / Admin Read; Owner Modify | Web Billing Settings | `tests/security/billing-tenant-isolation.test.ts` |
| **Usage Counters** | Organization | `organization_id` | `usage_counters_tenant_isolation` | Supervisor+ Read; Stored Proc Inc| Web Billing & Reports | `tests/security/plan-limits.test.ts` |
| **Billing Events** | Billing Provider | `organization_id` | `billing_events_tenant_isolation` | HMAC Signature Verified Server | Webhook Receiver | `tests/security/billing-webhook-security.test.ts` |
| **Report Audit Logs** | Organization | `organization_id` | `report_audit_logs_tenant_isolation`| Owner / Admin Read; User Insert | Web Reports Console | `tests/security/reporting-tenant-isolation.test.ts` |
| **Storage Objects** | Organization | Path: `{org_id}/...` | `storage_tenant_read_isolation` | Authenticated Active Member | Media Pre-Signed URLs | `tests/security/storage-file-upload-security.test.ts` |

---

## 3. Strict Non-Bypass Guarantees

1. **Zero Client Trust**: All authorization decisions occur server-side. Request headers (`x-tenant-id`) are verified against JWT claims and active database membership status.
2. **Service Role Quarantine**: Supabase `service_role` master key is excluded from web and mobile bundles.
3. **Storage Partitioning**: Direct public bucket access is prohibited. Storage paths require `{organization_id}/` prefix matching active tenant token claims.
