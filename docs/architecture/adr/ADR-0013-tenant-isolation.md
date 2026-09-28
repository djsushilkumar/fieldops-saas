# ADR-0013: Tenant Isolation, Row-Level Security & Client Cache Hygiene

## Status
Accepted

## Context
Multi-tenant architectures carry inherent risks of cross-tenant data leakage. In a field operations platform containing proprietary client locations, technician attendance logs, and sensitive customer job data, tenant isolation is a non-negotiable P0 security baseline (FieldOps Rule 6: "Never bypass tenant isolation").

Data leakage risks occur at two layers:
1. **Database / API Layer**: Weak query filtering where omitting a `tenant_id` WHERE clause returns another company's records.
2. **Client-Side Cache Layer**: Single Page Applications (SPAs) retaining cached React Query data in browser memory when an administrator or multi-org contractor switches between organizations.

## Decision
1. **Forced PostgreSQL Row-Level Security (RLS)**:
   - All tenant-owned tables (`organizations`, `memberships`, `profiles`, `organization_invitations`, `audit_logs`) execute `ALTER TABLE ... FORCE ROW LEVEL SECURITY`.
   - Security policies evaluate `current_tenant_id()` derived from session variables or JWT claims.
   - Non-active members (`SUSPENDED`, `REMOVED`, `INVITED`) are blocked by RLS policies from querying tenant data.
2. **Deterministic Foreign Key Cascades & Slug Validation**:
   - `slug` format is enforced by regex constraints (`^[a-z0-9]+(-[a-z0-9]+)*$`, 3-63 chars) preventing URL injection and homograph confusion.
3. **Client-Side Query Cache Namespace & Purge**:
   - Web application wraps TanStack Query keys with `['organization', activeOrgId, ...]`.
   - On organization switch, `OrganizationProvider` immediately calls `queryClient.removeQueries()` for all `organization` keys before binding the new tenant.
   - HTTP clients inject `x-tenant-id` header validated against server-side session membership.

## Consequences
### Positive
- Mathematically eliminates cross-tenant data leakage at the PostgreSQL kernel layer.
- Zero residual cache leakage when switching organizations in the web browser.
- Transparent to application developers; RLS handles filtering automatically.

### Negative
- PostgreSQL RLS introduces slight query planning overhead; mitigated with compound indices on `(organization_id, user_id)`.
