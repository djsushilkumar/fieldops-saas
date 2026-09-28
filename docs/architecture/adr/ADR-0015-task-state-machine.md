# ADR-0015: Task Finite State Machine & Lifecycle Governance

## Status
Accepted

## Context
FieldOps tasks represent physical, operational jobs executed by distributed field forces. In previous ad-hoc task systems, field workers often jump directly to completed, bypass mandatory checklist verifications, or arbitrarily close jobs without supervisor awareness. We need a deterministic, tamper-resistant lifecycle state machine that guarantees accountability and verification integrity across web, mobile, and backend layers.

## Decision
1. Implement a finite state machine with statuses: `DRAFT`, `ASSIGNED`, `ACCEPTED`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELED`.
2. Prohibit direct transition from `DRAFT` to `COMPLETED`.
3. Require 100% completion of mandatory checklist items (`is_required = true`) before a task can transition to `COMPLETED`.
4. Require a non-empty `blocked_reason` whenever transitioning to `BLOCKED`.
5. Strictly forbid Field Workers from canceling or reopening completed tasks.
6. Enforce transitions symmetrically in TypeScript shared domain logic (`@fieldops/types`), Dart mobile domain (`task_models.dart`), and PostgreSQL stored procedures (`transition_task_status`).

## Consequences
- **Positive**: Guarantees verification compliance across all operational work. Eliminates accidental task closures.
- **Negative**: Adds validation overhead on client and server before applying transitions.
- **Mitigation**: Clear error messages (`TASK_CHECKLIST_INCOMPLETE`, `TASK_INVALID_STATUS_TRANSITION`) explain exactly why a transition failed and how to remedy it.
