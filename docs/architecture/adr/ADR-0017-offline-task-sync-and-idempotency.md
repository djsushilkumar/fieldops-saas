# ADR-0017: Offline Task Sync, Idempotency & Concurrency Governance

## Status
Accepted

## Context
Technicians regularly execute verification checklists and update task states while disconnected from the internet. When devices regain connectivity, network retries or concurrent office updates can cause duplicate requests or overwrite newer server state. We require a synchronization protocol that guarantees idempotency and optimistic concurrency.

## Decision
1. **Client Idempotency Keys**: Every client mutation generates a globally unique `idempotencyKey` formatted as `idem_${userId}_${entityId}_${action}_${timestampMs}`.
2. **Server Deduplication**: The backend checks `offline_mutations` with `UNIQUE (tenant_id, idempotency_key)`. Repeated submissions are recognized and acknowledged as `DEDUPLICATED` without re-executing business logic.
3. **Optimistic Concurrency Control**: Tasks maintain an integer `version` field. Mutations must provide `expectedVersion`.
4. **Server-Authoritative Resolution**: In the event of a version conflict (`tasks.version != expectedVersion`), the server rejects the update with HTTP `409 Conflict` (`TASK_CONFLICT`). The client marks the mutation as `CONFLICT` and pulls the latest authoritative server record into the local cache.

## Consequences
- **Positive**: Complete protection against duplicate mutations and accidental overwrites during offline reconciliation.
- **Negative**: Outdated client mutations cannot automatically override supervisor reassignment or cancellation.
- **Mitigation**: Technicians are immediately notified with clear context when an authoritative change occurred on the server.
