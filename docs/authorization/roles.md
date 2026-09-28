# FieldOps — System Roles & Access Hierarchy

---

## 1. Role System Architecture

In FieldOps, roles are strictly **organization-scoped**. A user account does not possess a global system role; rather, their permissions are bound to a specific **Membership** within an **Organization** (`tenant_id`).

A user who is an `OWNER` of Tenant A can simultaneously be a `FIELD_WORKER` in Tenant B.

---

## 2. Authoritative System Roles

### 2.1. Owner (`OWNER`)
- **Scope**: Entire tenant organization.
- **Authority**:
  - Full operational authority.
  - Exclusive authority over billing instruments, subscription plans, payment methods, and tenant deletion.
  - Exclusive authority over appointing, transferring, or demoting other Owners.
- **Protection**: Protected by the database trigger `prevent_last_owner_removal()`. The last active Owner cannot be removed or demoted.

### 2.2. Admin (`ADMIN`)
- **Scope**: Organization-wide operational and personnel administration.
- **Authority**:
  - Employee onboarding, offboarding, and role assignment (up to `MANAGER`).
  - Organization settings management (timezones, default radiuses).
  - Security audit log inspection.
- **Restrictions**:
  - Cannot delete organization.
  - Cannot manage billing instruments or payment methods.
  - Cannot promote anyone to `OWNER` or deactivate an `OWNER`.

### 2.3. Manager (`MANAGER`)
- **Scope**: Departmental and cross-team operations.
- **Authority**:
  - Cross-team task creation, assignment, approval, and deletion.
  - Customer location register management.
  - Org-wide attendance monitoring.
- **Restrictions**:
  - Cannot invite users, manage billing, or view audit logs.

### 2.4. Supervisor (`SUPERVISOR`)
- **Scope**: Assigned field teams only.
- **Authority**:
  - Crew dispatch and assignment within assigned teams.
  - Check-in verification and proof of work review/approval.
  - Team attendance monitoring.
- **Restrictions**:
  - Scoped strictly to assigned teams via object-level security.
  - Cannot view organization settings or invite personnel.

### 2.5. Field Worker (`FIELD_WORKER`)
- **Scope**: Individual assigned tasks only.
- **Authority**:
  - Transition own assigned tasks (`ACCEPTED`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`).
  - GPS check-in/check-out on own assigned visits.
  - Clock in/out for shifts.
- **Restrictions**:
  - Strictly barred from viewing other technicians' work, organization settings, billing, or audit logs.
