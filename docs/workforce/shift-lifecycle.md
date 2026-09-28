# Shift Lifecycle State Machine

## 1. State Diagram

```mermaid
stateDiagram-v2
    [*] --> CLOCKED_IN : Clock In (with GPS Snapshot)
    CLOCKED_IN --> ON_BREAK : Pause Shift (Optional)
    ON_BREAK --> CLOCKED_IN : Resume Shift
    CLOCKED_IN --> CLOCKED_OUT : Clock Out (with Duration Calc)
    ON_BREAK --> CLOCKED_OUT : Clock Out
    CLOCKED_OUT --> CORRECTED : Manager Manual Adjustment (Audited)
    CLOCKED_IN --> CORRECTED : Manager Manual Adjustment (Audited)
    CORRECTED --> [*]
    CLOCKED_OUT --> [*]
```

## 2. Transition Rules

| Initial Status | Target Status | Permitted Roles | Conditions / Invariants |
| :--- | :--- | :--- | :--- |
| `[None]` | `CLOCKED_IN` | All Roles | No other active shift for user in organization. Coordinates within valid bounds. |
| `CLOCKED_IN` | `ON_BREAK` | Field Worker, Supervisor | Shift must be active. |
| `ON_BREAK` | `CLOCKED_IN` | Field Worker, Supervisor | Resumes active duty timer. |
| `CLOCKED_IN` / `ON_BREAK` | `CLOCKED_OUT` | Field Worker, Supervisor | Check-out timestamp $\ge$ check-in timestamp. Computes `duration_seconds`. Warns if tasks/visits in progress. |
| Any Status | `CORRECTED` | Manager, Admin, Owner | Justification $\ge$ 10 chars. Writes immutable audit log and updates `worker_activities`. |

## 3. Duplicate Shift Prevention

PostgreSQL stored procedure `record_attendance_checkin` queries existing records for `(organization_id, user_id)` where `status IN ('CLOCKED_IN', 'CHECKED_IN')`. If found, the transaction raises an exception preventing concurrent open shifts.
