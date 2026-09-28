# ADR-0005: Multi-Tenant Isolation Strategy (Row-Level Security)

- **Status**: Accepted
- **Date**: 2026-09-28
- **Author**: Lead Security & System Architect

---

## 1. Context

FieldOps serves SMB organizations whose operational records include sensitive customer locations, security codes, technician timecards, and proprietary equipment details. Data leakage across tenant boundaries would destroy commercial trust and trigger legal liabilities.

---

## 2. Problem

How should the data storage architecture enforce absolute multi-tenant isolation while remaining cost-effective, scalable, and maintainable across thousands of tenant organizations?

---

## 3. Options Considered

1. **Database-per-Tenant**:
   - *Pros*: Physical separation; zero risk of cross-tenant query bugs.
   - *Cons*: Prohibitive infrastructure costs for SMB pricing tiers ($10–$50/mo); impossible connection pooling; schema migrations across 5,000 databases are unreliable and slow.
2. **Schema-per-Tenant**:
   - *Pros*: Logical schema separation within a single database.
   - *Cons*: PostgreSQL catalog limits degrade past ~2,000 schemas; migrations require looping over all schemas.
3. **Shared Database with PostgreSQL Row-Level Security (RLS)**:
   - *Pros*: Unified migration pipeline; efficient resource utilization and connection pooling; database-level security policy evaluation (`USING (organization_id = current_tenant_id())`) that cannot be bypassed by missing application `WHERE` clauses.

---

## 4. Decision

We will implement a **Shared Database with PostgreSQL Row-Level Security (RLS)**:
- Every tenant table includes a non-nullable `organization_id UUID` column indexed and foreign-keyed to `organizations(id)`.
- Tables strictly enforce `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
- Session context is set per transaction: `SET LOCAL app.current_tenant_id = 'tenant-uuid'`.
- Automated cross-tenant penetration test suites verify 100% isolation on every CI run.

---

## 5. Consequences

- **Positive**: Cost-effective SMB scaling; kernel-level query isolation; single migration pipeline.
- **Negative**: Developers must ensure connection pools correctly set session context on every transaction.
