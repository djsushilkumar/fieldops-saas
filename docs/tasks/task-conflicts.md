# Optimistic Concurrency & Conflict Resolution Strategy

## 1. Overview

Because both dispatchers on the web management console and technicians on mobile apps can modify tasks, FieldOps implements a **Server-Authoritative, Optimistic Concurrency Control (OCC)** strategy.

---

## 2. OCC Mechanics

1. **Version Counter**: Every `tasks` record contains an integer `version` field starting at `1`.
2. **Atomic Increment**: Any update or stored procedure execution incrementing status increments `version = version + 1`.
3. **Collision Detection**:
   - Clients must send `expectedVersion` in mutation payloads.
   - If `tasks.version != expectedVersion`, the server immediately rejects the update with HTTP `409 Conflict` and error code `TASK_CONFLICT`.

---

## 3. Conflict Resolution Policy

FieldOps enforces a **Server-Authoritative** conflict resolution policy:
1. **Rejection of Stale Updates**: The server will never silently overwrite a newer state with stale client data.
2. **Client Refresh**: On receiving `TASK_CONFLICT`, the mobile client marks the local mutation as `CONFLICT` and pulls the latest authoritative server record into the local cache.
3. **User Notification**: The mobile UI alerts the technician that the task state was updated on the server (e.g., reassigned or canceled by supervisor) and presents the updated state.
