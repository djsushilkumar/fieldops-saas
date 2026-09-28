# ADR-0022: Audited Manual Attendance Adjustments

## Status
Accepted

## Context
In field operations, exceptions occur: a technician's mobile phone runs out of battery before shift end, equipment is damaged, or extreme weather disrupts cellular reception. Back-office operations managers must have the ability to correct or adjust recorded attendance times to reflect true working hours. However, arbitrary modifications introduce significant compliance and fraud risks (Rule 19: "Sensitive operations must be auditable").

## Decision
1. **Strict Role-Based Authorization**:
   - Only `OWNER`, `ADMIN`, and `MANAGER` roles hold `Permissions.ATTENDANCE_ADJUST`. Field workers and supervisors are strictly barred from adjusting attendance.
2. **Mandatory Justification Rationale**:
   - Any manual adjustment request must provide a justification reason of at least 10 non-whitespace characters (`adjustAttendanceSchema` and database procedure validation).
3. **Dual Audit Ledger Recording**:
   - The adjustment is recorded in the immutable `audit_logs` table with `action = 'ATTENDANCE_ADJUSTED'`, preserving the `before_state` and `after_state` JSON payloads and actor ID.
   - An event is also appended to the `worker_activities` timeline with `activity_type = 'ATTENDANCE_CORRECTED'`.
4. **State Transition & Flagging**:
   - The record status transitions to `CORRECTED`, `is_manually_adjusted` is set to `true`, and `adjusted_by_user_id` is recorded.
   - The Web and Mobile UIs display an unambiguous "Adjusted" badge with tooltip rationale to ensure operational transparency.

## Consequences
- Operations managers can rectify field anomalies while maintaining complete audit accountability.
- Unjustified or arbitrary time tampering is programmatically prevented.
