# Offline Task Engine & Synchronization Architecture

## 1. Executive Summary

Field forces regularly operate in basements, rural sites, industrial facilities, and elevators with intermittent or zero cellular connectivity. The FieldOps mobile application implements an offline-first architecture ensuring that:
1. Technicians can view tasks, execute verification checklists, and update task statuses without network access.
2. All local mutations are durable, queued with cryptographically random idempotency keys.
3. Upon network reconnection, queued mutations sync automatically and idempotently.

---

## 2. Mutation Lifecycle

```mermaid
sequenceDiagram
    participant Mobile as Mobile App (Offline)
    participant LocalDB as Local Queue / Cache
    participant Gateway as Sync Gateway (/sync/mutations)
    participant DB as PostgreSQL (Supabase)

    Mobile->>LocalDB: Enqueue mutation (idempotency_key, action, payload)
    LocalDB->>Mobile: Optimistic UI state update
    Note over Mobile,LocalDB: Device reconnects to network
    Mobile->>Gateway: POST /sync/mutations (batch of pending mutations)
    Gateway->>DB: Check idempotency_key in offline_mutations table
    alt Key exists (duplicate)
        DB-->>Gateway: Already processed
        Gateway-->>Mobile: Status: DEDUPLICATED
    else Key is new
        DB->>DB: Check version & execute transition_task_status()
        DB->>DB: Record offline_mutations (status: APPLIED)
        Gateway-->>Mobile: Status: APPLIED (new version)
    end
    Mobile->>LocalDB: Mark synced & clear queue
```

---

## 3. Idempotency Guarantees

Every client mutation generates:
- `mutationId`: UUID tracking the mutation instance.
- `idempotencyKey`: Unique string composed of `idem_${userId}_${entityId}_${action}_${timestampMs}`.

The database `offline_mutations` table maintains a `UNIQUE (tenant_id, idempotency_key)` constraint. If network retry or client reconnect causes duplicate delivery, the server returns status `DEDUPLICATED` without executing side effects twice.
