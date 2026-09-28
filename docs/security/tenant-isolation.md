# FieldOps — Tenant Isolation Architecture & Defense-in-Depth

---

## 1. Principles of Tenant Isolation

Tenant isolation is FieldOps's highest security priority. A breach of tenant boundaries violates customer data confidentiality and compromises operational trust.

FieldOps defends tenant boundaries across four independent layers:

1. **Kernel / Database Layer**: PostgreSQL Row-Level Security (RLS) forced on all tables.
2. **API Gateway Layer**: Session validation ensures the caller's JWT `tenant_id` or session membership matches the requested resource.
3. **Application Layer**: Centralized authorization engine (`can()`) blocks unprivileged actions.
4. **Client-Side Cache Layer**: Query cache keys are strictly namespaced by tenant ID and flushed on switching.

---

## 2. Invariant Rules

- **Zero Blind Queries**: Direct queries like `SELECT * FROM tasks` without tenant filtering are impossible; RLS automatically appends tenant checks.
- **Header Forgery Defense**: Providing a forged `x-tenant-id` header in HTTP requests has no effect if the authenticated user is not an `ACTIVE` member of that tenant in PostgreSQL.
- **Suspended Member Denials**: Inactive, suspended, or removed users cannot access any tenant records even if their access token has not yet reached its 60-minute expiration.
