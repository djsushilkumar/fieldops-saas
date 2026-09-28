# ADR-0007: Offline-First Synchronization & Conflict Strategy

- **Status**: Accepted
- **Date**: 2026-09-28
- **Author**: Lead Software Architect

---

## 1. Context

Field workers frequently operate with zero cellular reception. The mobile application must provide instant local write responses, guarantee zero lost evidence, and reliably synchronize with cloud services upon returning to cellular coverage.

---

## 2. Problem

What synchronization and conflict resolution architecture guarantees offline responsiveness and data integrity without introducing excessive complexity or data loss?

---

## 3. Options Considered

1. **Online-Only with HTTP Retry**:
   - *Pros*: Simple to implement.
   - *Cons*: Catastrophic failure in the field; technicians are blocked from completing work or taking photos when disconnected.
2. **Two-Way Realtime CRDT (Conflict-Free Replicated Data Types)**:
   - *Pros*: Mathematical eventual consistency for collaborative document editing.
   - *Cons*: Memory-heavy on low-end mobile devices; excessive complexity for rigid operational state machines (`DRAFT` $\rightarrow$ `COMPLETED`).
3. **Local Embedded Database + Idempotent Mutation Queue + Domain Conflict Policies**:
   - *Pros*: Sub-80ms local write latency; complete data durability; deterministic background sync with deduplication via idempotency keys; tailored conflict rules per operational domain.

---

## 4. Decision

We will implement **Option 3: Local Embedded Database + Idempotent Mutation Queue**:
- **Local Engine**: SQLite (via Drift on Flutter).
- **Queue**: FIFO mutation queue storing UUIDv7 `mutation_id`, `idempotency_key`, `payload`, and `client_timestamp`.
- **Sync Ingestion**: Batched `POST /api/v1/sync/mutations` with exponential backoff and jitter.
- **Domain Conflict Rules**:
  - *Task Status*: Server authoritative. If canceled by dispatch while worker is offline, task remains canceled, but worker-captured proof is permanently preserved in the audit log.
  - *Attendance*: Append-only event sequence; physical timestamps and GPS fixes are never overwritten.
  - *Checklists & Proof*: Client append-only; client-generated UUIDs prevent data overwrites.

---

## 5. Consequences

- **Positive**: Complete offline capability; zero field data loss; transparent sync status for workers; robust auditability.
- **Negative**: Requires managing local database schema migrations and sync worker lifecycle on mobile devices.
