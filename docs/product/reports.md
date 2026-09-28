# Operational Reports Specification

## 1. Overview & Information Architecture

FieldOps operational reporting empowers supervisors, operations managers, and business owners to evaluate field dispatch reliability, verify task completion rates, track workforce attendance patterns, and securely export data for operational records.

Reporting is accessed via the **Reports** section in the web management console:
- `/reports`: Operational Overview & Metric Cards.
- `/reports/tasks`: Task Execution, Priorities & SLA Breaches.
- `/reports/visits`: Field Appointments, Check-ins & GPS Verification Outcomes.
- `/reports/attendance`: Shift Logs, Hours Worked & Manual Adjustments.
- `/reports/workforce`: Worker Operational Volume & Activity Totals.

---

## 2. Report Summaries & Data Schemas

### 2.1. Task Report (`/reports/tasks`)
- **Filters**: Date range (`fromDate`, `toDate`), Status, Priority, Assignee (Worker), Team, Location.
- **Summary KPIs**: Total Tasks, Completed Tasks, Completion Rate (%), In Progress, Overdue Tasks, Blocked Tasks.
- **Table Columns**:
  1. Task ID (Monospace abbreviation)
  2. Title
  3. Priority (`URGENT`, `HIGH`, `MEDIUM`, `LOW`)
  4. Status (`DRAFT`, `ASSIGNED`, `ACCEPTED`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELED`)
  5. Assignee (Worker Name & Email)
  6. Due Date (Formatted local time)
  7. Completed Date (or '—')
  8. Checklists Ratio (e.g. 4/4 done)

### 2.2. Visit Report (`/reports/visits`)
- **Filters**: Date range, Status, Location, Assignee (Worker), Verification Result (`VALID`, `OUTSIDE_RADIUS`, `LOW_ACCURACY`).
- **Summary KPIs**: Total Scheduled, Completed Visits, On-Time Check-In Rate (%), Geofence Verification Rate (%), Missed Visits.
- **Table Columns**:
  1. Visit ID
  2. Location Name
  3. Field Worker
  4. Scheduled Window (Start – End)
  5. Check-in Timestamp
  6. GPS Verification Result (`VALID`, `OUTSIDE_RADIUS`, `LOW_ACCURACY`)
  7. Proofs Captured Count
  8. Status (`SCHEDULED`, `READY`, `CHECKED_IN`, `IN_PROGRESS`, `CHECKED_OUT`, `COMPLETED`, `MISSED`, `CANCELED`)

### 2.3. Attendance Report (`/reports/attendance`)
- **Filters**: Date range, Worker, Status, Only Manually Adjusted.
- **Summary KPIs**: Total Shifts Logged, Completed Shifts, Total Duty Hours, Shift Correction Rate (%).
- **Table Columns**:
  1. Date (YYYY-MM-DD)
  2. Worker Name
  3. Clock-in Time
  4. Clock-out Time
  5. Shift Duration (Hours & Minutes, e.g. 8h 15m)
  6. Status (`CLOCKED_IN`, `CLOCKED_OUT`, `CORRECTED`)
  7. Adjustment Flag & Reason

### 2.4. Workforce Activity Report (`/reports/workforce`)
- **Filters**: Date range, Team, Worker.
- **Summary KPIs**: Active Workforce Count, Total Tasks Handled, Total Visits Dispatched, Total Operational Events.
- **Table Columns**:
  1. Worker Name & Role
  2. Assigned Tasks Count
  3. Completed Tasks Count
  4. Scheduled Visits Count
  5. Completed Visits Count
  6. Completed Shifts Count
  7. Total Recorded Operational Activities
- **Fairness & Privacy Mandate**: Zero toxic gamification, scoreboards, or automated employee rankings.
