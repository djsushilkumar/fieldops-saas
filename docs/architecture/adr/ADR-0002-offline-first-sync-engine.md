# ADR-0002: Offline-First Synchronization & Mutation Queue Engine

- **Status**: Accepted
- **Date**: 2026-09-28
- **Author**: Lead Product & System Architect
- **Deciders**: Engineering Lead, Mobile Lead

---

## 1. Context

Field technicians operating in basements, steel-reinforced mechanical rooms, and remote infrastructure sites experience intermittent or absent cellular connectivity. Traditional web-first CRUD applications that require immediate round-trip HTTP requests to complete actions fail in these environments, causing app freezes, lost notes, and worker frustration.

---

## 2. Problem

How should FieldOps architect the mobile client and synchronization protocol to guarantee:
1. Sub-100ms local write latency regardless of connectivity.
2. Complete data durability across app restarts and dead batteries.
3. Deterministic background synchronization without duplicate mutations or lost proof of work.

---

## 3. Options Considered

1. **Online-Only with HTTP Retry Buffers**: Simple to build, but fails when offline for hours. Blocks the technician from completing checklists or taking photos. *(Rejected)*
2. **Full Two-Way CRDT (Conflict-Free Replicated Data Types)**: Highly resilient for collaborative document editing, but overly complex for state machine workflows (`DRAFT` → `COMPLETED`), memory-intensive on low-end mobile devices, and difficult to audit. *(Rejected)*
3. **Local Embedded Database + Idempotent Mutation Queue + Server-Authoritative State Engine**:
   - Mobile writes directly to local SQLite/embedded storage with client-generated UUIDs.
   - Mutations are appended to a persistent FIFO sync queue with idempotency keys.
   - Background worker drains the queue upon network restoration.
   - Server validates state transitions and deduplicates by idempotency key.
   - Proof of work (photos, signatures) is append-only and never overwritten. *(Selected)*

---

## 4. Decision

We will implement **Option 3: Local Embedded Database + Idempotent Mutation Queue**:
- **Local Engine**: SQLite-backed local storage (e.g. WatermelonDB / drift / Room / CoreData abstraction).
- **Optimistic UI**: UI updates immediately upon local commit.
- **Idempotency Keys**: Formed as `hash(user_id, client_timestamp, entity_id, action)`.
- **Sync Protocol**:
  - Outbound: Batched `POST /api/v1/sync/mutations` with exponential backoff and jitter.
  - Inbound: Delta sync via `GET /api/v1/sync/delta?since_cursor={timestamp_or_version}`.
- **Conflict Resolution**:
  - Operational status transitions: Server-authoritative validation against strict state machine.
  - Proof of work (media, checklists): Client append-only; server never deletes client proof. If a task was canceled on the web console, attached offline proof is preserved in the audit log.

---

## 5. Consequences

- **Positive**: 100% offline operability; workers never blocked; battery-friendly batched sync; robust auditability.
- **Negative**: Engineering complexity in mobile local database schema management and migration synchronization.
