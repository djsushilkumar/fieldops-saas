# FieldOps Operational Metrics & KPI Definitions

This document defines the server-authoritative operational metrics and Key Performance Indicators (KPIs) surfaced in the **Manager/Admin Web Operations Console**.

---

## 1. Operational Philosophy & Scope

Operational metrics in FieldOps are designed for **real-time dispatch and supervisor situational awareness**. They answer immediate operational questions:
- *What work needs attention right now?*
- *Who is currently working in the field?*
- *Which tasks or visits have breached operational thresholds?*

Operational metrics are strictly operational dispatch metrics; long-term financial reporting, business intelligence (BI), and SaaS billing analytics are out of scope (reserved for Phase 08).

---

## 2. Core Operational Metrics Definitions

### 2.1 Tasks Today
- **Definition**: The total count of active tasks associated with the organization whose scheduled due date falls on the organization's current operational date ($T_{\text{start}} \le \text{dueAt} \le T_{\text{end}}$), or tasks created today with no due date.
- **Formula**:
  $$\text{Tasks Today} = |\{ t \in \text{Tasks}_{\text{tenant}} \mid \text{isDateMatch}(t.\text{dueAt}, \text{Date}_{\text{today}}) \lor (t.\text{dueAt} = \text{null} \land \text{isDateMatch}(t.\text{createdAt}, \text{Date}_{\text{today}})) \}|$$
- **Statuses Included**: `ASSIGNED`, `ACCEPTED`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`.
- **Statuses Excluded**: `DRAFT` (unless explicitly filtered), `CANCELED`.

### 2.2 Overdue Tasks
- **Definition**: Tasks whose scheduled `dueAt` timestamp is strictly earlier than current UTC time and whose status is not in a terminal state (`COMPLETED` or `CANCELED`).
- **Formula**:
  $$\text{Overdue Tasks} = |\{ t \in \text{Tasks}_{\text{tenant}} \mid t.\text{status} \notin \{\text{COMPLETED}, \text{CANCELED}\} \land t.\text{dueAt} < \text{Now}_{\text{UTC}} \}|$$
- **Urgency Indicator**: Tasks overdue by $> 4$ hours or with priority `URGENT` trigger operational exception alerts.

### 2.3 Visits Today
- **Definition**: Field visits scheduled to occur on the organization's operational date.
- **Formula**:
  $$\text{Visits Today} = |\{ v \in \text{Visits}_{\text{tenant}} \mid \text{isDateMatch}(v.\text{scheduledStart}, \text{Date}_{\text{today}}) \}|$$
- **Lifecycle Sub-Categories**:
  - **Upcoming / Scheduled**: $v.\text{status} \in \{\text{SCHEDULED}, \text{READY}\}$
  - **In Progress / Active**: $v.\text{status} \in \{\text{CHECKED\_IN}, \text{IN\_PROGRESS}\}$
  - **Completed**: $v.\text{status} \in \{\text{CHECKED\_OUT}, \text{COMPLETED}\}$
  - **Missed / Overdue**: $v.\text{status} = \text{MISSED} \lor (v.\text{status} \in \{\text{SCHEDULED}, \text{READY}\} \land v.\text{scheduledEnd} < \text{Now}_{\text{UTC}})$

### 2.4 Active Field Workers
- **Definition**: Field workers with an active shift record for the current operational date who have not clocked out.
- **Formula**:
  $$\text{Active Workers} = |\{ a \in \text{Attendance}_{\text{tenant}} \mid a.\text{date} = \text{Date}_{\text{today}} \land a.\text{status} = \text{CLOCKED\_IN} \land a.\text{checkOutAt} = \text{null} \}|$$

### 2.5 Attendance Status & Ratio
- **Definition**: The proportion of active field staff who have clocked in for today's operational window versus the total eligible active field force.
- **Formula**:
  $$\text{Attendance Ratio} = \frac{\text{Active Workers}}{\text{Total Active Field Workers in Tenant}}$$
- **State Categories**:
  - `CLOCKED_IN`: Currently active on duty.
  - `CLOCKED_OUT`: Completed duty for the day.
  - `NOT_CHECKED_IN`: Eligible field worker with no attendance record logged for today.

### 2.6 Operational Exceptions
- **Definition**: Aggregate count of operational events requiring managerial or supervisory intervention.
- **Components**:
  1. **Blocked Tasks**: Tasks with status `BLOCKED` (waiting on parts, client access, or safety clearance).
  2. **Overdue Tasks**: Tasks past due date not completed.
  3. **Missed Visits**: Visits whose scheduled window has lapsed without check-in.
  4. **Geofence Overrides / Violations**: Visit check-ins recorded with `is_within_geofence = false` or with manual exception overrides.
  5. **Low GPS Accuracy**: Check-in events with GPS accuracy $> 50$ meters.
- **Formula**:
  $$\text{Operational Exceptions} = \text{Blocked Tasks} + \text{Overdue Tasks} + \text{Missed Visits} + \text{Geofence Overrides}$$

---

## 3. Calculation & Privacy Rules

1. **Tenant Isolation**: Every calculation is strictly partitioned by `organization_id = current_tenant_id()`. Cross-tenant aggregation is mathematically impossible under PostgreSQL RLS.
2. **Authoritative Time Source**: Timestamps are compared against UTC standard (`ISO-8601`). The organization's configured timezone (e.g. `America/New_York`) defines the local date boundaries ($00:00:00$ to $23:59:59$) for grouping daily operations.
3. **Location Privacy**: Operational coordinates are captured strictly at discrete workflow events (Clock-in, Visit Check-in/Check-out, Clock-out). No continuous telematics or live tracking points are calculated or stored.
