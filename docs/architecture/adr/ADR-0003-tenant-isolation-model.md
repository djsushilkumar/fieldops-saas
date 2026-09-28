# ADR-0003: Multi-Tenant Data Isolation Strategy

- **Status**: Accepted
- **Date**: 2026-09-28
- **Author**: Lead Product & System Architect
- **Deciders**: Engineering Lead, Security Architect

---

## 1. Context

FieldOps serves SMB customers whose operational data includes proprietary customer addresses, equipment configurations, technician phone numbers, and timecards. Leaking data across tenant boundaries would be catastrophic to business trust and legal compliance.

---

## 2. Problem

How should the data storage architecture be structured to guarantee absolute tenant isolation while remaining cost-effective and operationally manageable across thousands of SMB tenant organizations?

---

## 3. Options Considered

1. **Database-per-Tenant**:
   - Each organization receives a dedicated PostgreSQL database instance.
   - *Pros*: Physical isolation; zero risk of cross-tenant query bugs.
   - *Cons*: Prohibitive infrastructure cost for SMB tiers ($10–$50/mo); complex connection pooling; running migrations across 10,000 databases is unreliable and slow. *(Rejected)*
2. **Schema-per-Tenant**:
   - Shared database, but each organization has an isolated PostgreSQL schema (`org_uuid.tasks`).
   - *Pros*: Logical separation; cleaner query isolation than raw tables.
   - *Cons*: PostgreSQL catalog limits degrade performance past a few thousand schemas; migrations require looping over all schemas. *(Rejected)*
3. **Shared Database, Shared Schema with PostgreSQL Row-Level Security (RLS)**:
   - All tenant rows reside in unified tables with mandatory `organization_id UUID` columns.
   - PostgreSQL RLS policies enforce tenant boundaries at the database engine level based on session variables (`app.current_tenant_id`).
   - *Pros*: Maximum resource efficiency; seamless connection pooling; unified migrations; database-level enforcement that cannot be bypassed by missing application `WHERE` clauses. *(Selected)*

---

## 4. Decision

We will implement **Option 3: Shared Database with PostgreSQL Row-Level Security (RLS)**:
- Every table containing tenant data must include:
  `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- Composite indexes will lead with `(organization_id, ...)` to ensure indexed tenant filtering.
- PostgreSQL Row-Level Security will be enabled on all tenant tables:
  ```sql
  ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

  CREATE POLICY tenant_isolation_policy ON tasks
    AS RESTRICTIVE
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  ```
- Application connection pools will set the session context on transaction acquisition:
  `SET LOCAL app.current_tenant_id = 'tenant-uuid';`
- Automated test suites will run cross-tenant penetration tests against every endpoint and query.

---

## 5. Consequences

- **Positive**: Complete cost scalability for SMB pricing; bulletproof kernel-level query isolation; single migration pipeline.
- **Negative**: Developers must ensure `app.current_tenant_id` is reliably set on every transactional connection or worker execution context.
