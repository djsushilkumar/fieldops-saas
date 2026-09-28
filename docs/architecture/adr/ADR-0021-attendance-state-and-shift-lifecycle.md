# ADR-0021: Attendance State Machine and Shift Lifecycle

## Status
Accepted

## Context
In field force operations, tracking worker shifts and duty duration is critical for accountability, SLA compliance, and dispatch safety. Unlike casual timecard systems, field force attendance must satisfy three stringent requirements:
1. Prevent concurrent open shifts per user across devices.
2. Capture tamper-evident point-in-time GPS fixes upon clock-in and clock-out without continuous background battery drain.
3. Support offline mobile operation with optimistic state and durable mutation queue synchronization.

## Decision
1. **Attendance State Machine**:
   - `CLOCKED_IN` (or `CHECKED_IN`): Active duty shift. Timer runs in foreground; arrival GPS fix recorded.
   - `ON_BREAK`: Temporary duty pause (optional).
   - `CLOCKED_OUT` (or `CHECKED_OUT`): Completed shift. Departure GPS fix and duration recorded.
   - `CORRECTED`: Shift adjusted by an authorized manager or supervisor.
2. **Shift Exclusivity**:
   - At the database level, `record_attendance_checkin` stored procedure and partial unique index on `(organization_id, user_id) WHERE status IN ('CLOCKED_IN', 'CHECKED_IN')` strictly prevents a worker from having multiple active open shifts.
3. **Offline Resilience**:
   - Clock-in and clock-out mutations are enqueued into the `OfflineMutationQueue` with deterministic idempotency keys (`idem_<userId>_<shiftId>_<action>_<timestamp>`).
4. **Append-Only Activity Ledger**:
   - Every clock event writes an immutable entry into `worker_activities` protected by trigger `prevent_worker_activity_modification()`.

## Consequences
- Single active shift guarantee prevents erroneous multiple clock-ins.
- Offline technicians can start shifts even in sub-basements or cellular dead zones.
- Auditable trail of shift transitions is preserved permanently.
