# FieldOps — Security Principles & Data Protection

---

## 1. Executive Security Mandate

FieldOps handles mission-critical operational data, customer site coordinates, physical access details, and workforce attendance logs. Security is not an afterthought or an administrative checklist; it is an intrinsic architectural invariant.

---

## 2. The Ten Non-Negotiable Security Principles

Every engineer, system architect, and AI coding agent working on FieldOps must adhere strictly to these ten foundational principles:

### Principle 1: Never Trust Client-Side Authorization
- Client-side role checks, disabled buttons, and hidden navigation routes are cosmetic UX conveniences, never security boundaries.
- The mobile app and web dashboard run in untrusted user environments. An attacker can decompile mobile code, manipulate local SQLite databases, or forge API requests.
- Every API route and background job must independently validate the caller's identity, organization, and permissions.

### Principle 2: Server-Side Authorization is Mandatory
- Every mutation, read, or export operation must evaluate role permissions on the server before executing business logic.
- Role checks must evaluate object-level ownership: A `Field Worker` role cannot access `/api/v1/tasks/{id}` unless that task is explicitly assigned to that worker. A `Supervisor` cannot modify tasks outside their supervised teams.

### Principle 3: Database-Level Tenant Isolation is Mandatory
- Application-level `WHERE organization_id = ...` clauses are insufficient as a lone defense.
- Database **Row-Level Security (RLS)** must be enforced on every tenant-owned table in PostgreSQL (`ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`).
- Even if a developer accidentally omits an organization filter in an ORM query, the database engine itself will refuse to return or mutate records belonging to other tenants.

### Principle 4: Privileged Credentials Must Never Reach Clients
- Database connection strings, service role keys, master encryption secrets, third-party payment secret keys, and cloud storage master credentials must **never** be exposed in client codebases, mobile application bundles, or web source maps.
- Mobile clients communicate strictly with the authenticated FieldOps API using short-lived JWT access tokens.

### Principle 5: Sensitive Operations Must Be Authenticated
- Anonymous endpoints are strictly limited to initial login, password reset request, and system health checks.
- All operational actions (clock-in, task transition, check-in, media upload) require a cryptographically verified session token tied to an active, non-deactivated user account.

### Principle 6: Destructive Operations Require Explicit Authorization & Safeguards
- Deleting an organization, purges of audit records, removing team members, or mass-canceling visits requires `Owner` or `Admin` authorization.
- Deletions are implemented with soft-delete flags (`deleted_at IS NOT NULL`) to enable emergency recovery from operational accidents.
- Destructive actions must require explicit confirmation (e.g. typing confirmation text or re-authenticating).

### Principle 7: Audit Sensitive Changes
- Any mutation affecting system security or financial/operational integrity must write an append-only audit event to `audit_logs`.
- Audited actions include: Member invitations, role promotions/demotions, manual attendance adjustments, geofence exception overrides, task cancellations, and bulk data exports.
- Audit logs are immutable: direct `UPDATE` or `DELETE` operations are forbidden.

### Principle 8: File Access Must Be Authorized
- Proof-of-work images, client signatures, and attachments must not be stored in publicly accessible cloud buckets.
- All media uploads utilize temporary, pre-signed upload URLs generated server-side after verifying task permissions.
- All media downloads utilize short-lived (15-minute) signed download URLs verified against tenant membership.

### Principle 9: Organization Boundaries Must Never Be Bypassed
- There is no concept of a "cross-tenant query" in standard operational APIs.
- Superuser or support operations that require cross-tenant visibility must occur through dedicated, audited internal tooling with dual-control authorization, never through public client endpoints.

### Principle 10: Tests Must Verify Tenant Isolation
- Passing unit tests is insufficient. Every feature introducing or querying tenant data must be accompanied by automated **Cross-Tenant Security Tests**.
- Tests must explicitly simulate:
  - User from Tenant A attempting to read Tenant B's task $\rightarrow$ Expect `404 Not Found` (or `403 Forbidden`).
  - User from Tenant A attempting to modify Tenant B's visit $\rightarrow$ Expect `404 Not Found` (or `403 Forbidden`).
  - Worker attempting to view unassigned tasks $\rightarrow$ Expect `403 Forbidden`.

---

## 3. Data Privacy & Workforce Governance

1. **Anti-Surveillance Guarantee**: FieldOps explicitly forbids 24/7 background location surveillance. Location coordinates are only captured upon discrete operational triggers (Shift Clock-In/Out, Visit Check-In/Out, Task completion, and active on-duty breadcrumbs if configured).
2. **Data Retention**: Detailed GPS breadcrumb coordinate trails are retained for a maximum of 90 days before automatic downsampling. Verified visit check-in audit records (time, distance, result) are retained for legal audit compliance.
3. **Transport Encryption**: All client-server traffic is encrypted using TLS 1.3 in transit. All database volumes and object storage buckets are encrypted at rest using AES-256.
