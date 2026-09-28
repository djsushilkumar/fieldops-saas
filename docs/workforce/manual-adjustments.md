# Audited Manual Attendance Adjustments

## 1. Compliance Background

Under labor regulations and FieldOps operational standards, manual alterations to employee shift records must be strictly controlled, justified, and immutable.

## 2. Authorization Rules

- **Allowed Roles**: `OWNER`, `ADMIN`, `MANAGER` (`Permissions.ATTENDANCE_ADJUST`).
- **Prohibited Roles**: `FIELD_WORKER` and `SUPERVISOR` cannot adjust shift records. Attempted client or API invocations result in HTTP 403 `AUTHORIZATION_ERROR`.

## 3. Justification Validation

- **Length Threshold**: The justification text must contain at least 10 non-whitespace characters.
- **Client & Server Enforcement**: Validated on the web frontend via `adjustAttendanceSchema`, in the API client, and in the PostgreSQL stored procedure `adjust_attendance`.

## 4. Immutable Audit Ledger Entry

Every execution of `adjust_attendance` writes to the `audit_logs` table:
```json
{
  "action": "ATTENDANCE_ADJUSTED",
  "actor_id": "<manager_uuid>",
  "entity_type": "attendance_records",
  "entity_id": "<attendance_uuid>",
  "before_state": {
    "check_in_at": "2026-09-28T08:00:00.000Z",
    "check_out_at": null,
    "status": "CLOCKED_IN",
    "duration_seconds": null
  },
  "after_state": {
    "check_in_at": "2026-09-28T08:00:00.000Z",
    "check_out_at": "2026-09-28T16:30:00.000Z",
    "status": "CORRECTED",
    "duration_seconds": 30600,
    "reason": "Technician battery died; verified departure via facility security desk log."
  }
}
```
Direct updates and deletes on `audit_logs` are prohibited by PostgreSQL trigger `prevent_audit_log_modification()`.
