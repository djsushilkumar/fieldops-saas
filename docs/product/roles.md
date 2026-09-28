# FieldOps — Roles & Permissions Matrix

---

## 1. Role System Architecture

FieldOps implements strict, multi-tenant Role-Based Access Control (RBAC). Every user account belongs to an **Organization** (`tenant_id`) and is assigned exactly one primary system role within that organization.

Authorization is **strictly enforced server-side**. Client-side UI toggles and route guards exist purely for UX convenience; API endpoints and database row-level security (RLS) validate every request against the authenticated user's organization and role.

---

## 2. Defined System Roles

### 2.1. Owner
- **Scope**: Organization-wide (Superuser of the tenant).
- **Core Focus**: Corporate governance, subscription and billing management, legal and financial oversight, strategic reporting, disaster recovery.
- **Unique Authority**: Only the Owner can delete the organization account, transfer ownership, or manage payment instruments.

### 2.2. Admin
- **Scope**: Organization-wide operational and administrative management.
- **Core Focus**: Employee onboarding and offboarding, system configuration, team territory definitions, role assignments (excluding Owner), client location management, compliance auditing.

### 2.3. Manager
- **Scope**: Multiple Teams / Operational Department.
- **Core Focus**: Capacity planning, scheduling, cross-team dispatch, SLA oversight, team-level performance analytics, exception escalations.

### 2.4. Supervisor
- **Scope**: Assigned Teams only.
- **Core Focus**: Direct field crew dispatch, real-time arrival verification, review and approval of submitted proof of work, operational troubleshooting (e.g. unblocking stuck technicians), attendance review for their direct team.

### 2.5. Field Worker
- **Scope**: Individual self-assigned work only.
- **Core Focus**: Executing assigned tasks, checking in/out of scheduled visits, logging GPS presence, completing checklists, submitting photo/signature evidence, clocking shift attendance.
- **Data Boundary**: Field workers **cannot** browse other workers' tasks, cannot access billing or audit logs, and cannot view organization-wide reports.

---

## 3. Comprehensive Role Capability Matrix

Legend:
- `✓` = Full access / Allowed
- `Team` = Restricted to user's assigned teams
- `Own` = Restricted to user's own assigned records or identity
- `—` = Forbidden / No access

| Resource & Action | Owner | Admin | Manager | Supervisor | Field Worker |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Organization & Billing** | | | | | |
| View Organization Profile & Settings | ✓ | ✓ | View Only | — | — |
| Modify Organization Settings (Timezone, Geofence Default) | ✓ | ✓ | — | — | — |
| View Billing, Invoices & Subscription Plan | ✓ | View Only | — | — | — |
| Change Subscription Plan / Payment Method | ✓ | — | — | — | — |
| Delete Organization Account | ✓ | — | — | — | — |
| **User & Team Management** | | | | | |
| Invite New Users | ✓ | ✓ | — | — | — |
| Deactivate / Remove Users | ✓ | ✓ | — | — | — |
| Assign System Roles | ✓ | ✓ (except Owner) | — | — | — |
| Create / Edit Teams & Territories | ✓ | ✓ | ✓ | — | — |
| Assign Employees to Teams | ✓ | ✓ | ✓ | — | — |
| View Employee Profiles & Phone Numbers | ✓ | ✓ | ✓ | Team | Own |
| **Locations & Geofences** | | | | | |
| Create / Edit Customer Locations & Geofence Radii | ✓ | ✓ | ✓ | View Only | View Assigned |
| Delete Customer Locations | ✓ | ✓ | — | — | — |
| **Task Management** | | | | | |
| Create New Tasks | ✓ | ✓ | ✓ | ✓ | — |
| Assign / Reassign Tasks | ✓ | ✓ | ✓ | Team | — |
| Edit Task Details, Checklists, & Priorities | ✓ | ✓ | ✓ | Team | — |
| Transition Task State (`ACCEPTED`, `IN_PROGRESS`, `BLOCKED`) | ✓ | ✓ | ✓ | Team | Own |
| Transition Task to `COMPLETED` | ✓ | ✓ | ✓ | Team | Own (Pending review if required) |
| Approve / Reopen Completed Tasks | ✓ | ✓ | ✓ | Team | — |
| Delete / Cancel Tasks | ✓ | ✓ | ✓ | Team | — |
| View All Tasks in Organization | ✓ | ✓ | ✓ | — | — |
| View Assigned Team Tasks | ✓ | ✓ | ✓ | ✓ | — |
| View Own Assigned Tasks | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Field Visits** | | | | | |
| Schedule / Dispatch Visits | ✓ | ✓ | ✓ | Team | — |
| Reschedule / Cancel Visits | ✓ | ✓ | ✓ | Team | — |
| Perform GPS Check-In / Check-Out | — | — | — | Own | Own |
| Override Geofence Exception (Approve Out-of-Bounds) | ✓ | ✓ | ✓ | Team | — |
| View All Visits Across Org | ✓ | ✓ | ✓ | — | — |
| View Team Visits | ✓ | ✓ | ✓ | ✓ | — |
| View Own Assigned Visits | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Attendance & Working Status** | | | | | |
| Perform Shift Clock-In / Clock-Out | ✓ | ✓ | ✓ | ✓ | Own |
| View Org-Wide Attendance Board | ✓ | ✓ | ✓ | — | — |
| View Team Attendance Board | ✓ | ✓ | ✓ | ✓ | — |
| Manual Correction / Adjustment of Attendance Times | ✓ | ✓ | Team (Audited) | — | — |
| **Proof of Work & Media** | | | | | |
| Capture / Upload Photo Proof & Signatures | ✓ | ✓ | ✓ | Own | Own |
| View Attached Proof of Work | ✓ | ✓ | ✓ | Team | Own |
| Delete Proof of Work Attachments | ✓ | ✓ | — | — | — |
| **Reports, Analytics & Audit** | | | | | |
| View Operational Dashboard & KPI Cards | ✓ | ✓ | ✓ | Team View | — |
| View Live Operational Map | ✓ | ✓ | ✓ | Team View | — |
| View & Export SLA, Attendance & Visit Reports | ✓ | ✓ | Team View | Team View | — |
| View Security & System Audit Logs | ✓ | ✓ | — | — | — |

---

## 4. Architectural Rules for Permissions

1. **No Implicit Elevation**: A Supervisor cannot grant Admin rights; an Admin cannot demote an Owner.
2. **Context-Driven Row-Level Security (RLS)**:
   - Queries executed by a `Field Worker` append: `WHERE organization_id = :org_id AND assignee_id = :user_id`.
   - Queries executed by a `Supervisor` append: `WHERE organization_id = :org_id AND team_id IN (:user_supervised_teams)`.
   - Queries executed by a `Manager` append: `WHERE organization_id = :org_id AND (team_id IN (:user_managed_teams) OR organization_id = :org_id)`.
3. **Audit Trail on Privileged Overrides**: Any manual adjustment of clock-in timestamps or geofence exception overrides requires an audit log entry detailing `actor_id`, `target_record_id`, `previous_value`, `new_value`, and `reason`.
