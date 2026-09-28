# ADR-0003: Backend Architecture Strategy (Supabase & PostgreSQL)

- **Status**: Accepted
- **Date**: 2026-09-28
- **Author**: Lead Software Architect

---

## 1. Context

FieldOps requires a robust backend foundation providing enterprise multi-tenancy, authentication, secure file storage, spatial query capabilities (geofencing), and real-time state synchronization for dispatchers. Building all of these primitives from scratch on raw infrastructure would consume months of engineering time without adding unique business value.

---

## 2. Problem

What backend architectural foundation provides the optimal balance between rapid development velocity, enterprise security, and long-term infrastructure control?

---

## 3. Options Considered

1. **Custom Monolithic Backend from Scratch (e.g. Node/Express or Go)**:
   - *Pros*: Complete custom control over every line of code.
   - *Cons*: Re-inventing authentication, JWT token refresh, file storage ACLs, and WebSocket dispatchers; massive maintenance overhead.
2. **Proprietary No-Code / Backend-as-a-Service (e.g. Firebase)**:
   - *Pros*: Fast initial prototype.
   - *Cons*: Weak relational querying; vendor lock-in; lacks PostgreSQL Row-Level Security and PostGIS spatial capabilities; difficult multi-tenant isolation.
3. **Supabase Core + PostgreSQL with PostGIS + Modular Domain Services**:
   - *Pros*: Open-source PostgreSQL foundation; native PostGIS spatial extensions; out-of-the-box JWT authentication with RLS policy integration; S3-compatible storage with signed URLs; self-hostable or cloud-managed.

---

## 4. Decision

We will adopt **Supabase capabilities backed by PostgreSQL 15+ and PostGIS**:
- **PostgreSQL**: Serves as the authoritative multi-tenant relational store, enforcing tenant isolation via database-level Row-Level Security (RLS).
- **PostGIS**: Provides spatial calculations for Haversine distance and geofence verification.
- **Supabase Auth (GoTrue)**: Manages secure user authentication, password hashing, and JWT issuance with tenant claims.
- **Supabase Storage**: Manages photo proof and signature storage with pre-signed URL authorization.
- **Edge Functions / Domain Services**: Handles complex operational dispatch workflows and external integration webhooks.

---

## 5. Consequences

- **Positive**: Eliminates thousands of lines of boilerplate auth/storage code; guarantees standard PostgreSQL portability; provides enterprise-grade RLS data isolation.
- **Negative**: Requires engineers to master PostgreSQL Row-Level Security syntax and Supabase local CLI tooling.
