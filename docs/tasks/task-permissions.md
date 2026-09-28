# Task Authorization & Permissions Matrix

## 1. Overview

FieldOps enforces role-based access control (RBAC) with object-level scoping for all task operations. Access decisions are evaluated identically across frontend UI components, API gateways, and PostgreSQL Row-Level Security (RLS) policies.

---

## 2. Role Capability Matrix for Tasks

| Action / Capability | Owner | Admin | Manager | Supervisor | Field Worker |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Create Task (`task:create`)** | Yes | Yes | Yes | Yes | **No** |
| **Assign / Reassign Task (`task:assign`)** | Yes | Yes | Yes | Team Only | **No** |
| **View All Tenant Tasks (`task:view:all`)** | Yes | Yes | Yes | **No** | **No** |
| **View Team Tasks (`task:view:team`)** | Yes | Yes | Yes | Assigned Teams | **No** |
| **View Own Assigned Tasks (`task:view:own`)** | Yes | Yes | Yes | Yes | **Assigned Only** |
| **Update Task Details (`task:update`)** | Yes | Yes | Yes | Team Only | **No** |
| **Transition Status (Accept, Start, Block)** | Yes | Yes | Yes | Team Only | Assigned Only |
| **Complete Task (`task:complete`)** | Yes | Yes | Yes | Team Only | Assigned Only |
| **Reopen Completed Task** | Yes | Yes | Yes | Yes | **No** |
| **Cancel Task** | Yes | Yes | Yes | Yes | **No** |
| **Delete Task (`task:delete`)** | Yes | Yes | Yes | Team Only | **No** |
| **Manage Checklist Items** | Yes | Yes | Yes | Team Only | **No** |
| **Toggle Checklist Completion** | Yes | Yes | Yes | Team Only | Assigned Only |
| **Add Comments / Notes** | Yes | Yes | Yes | Team Only | Assigned Only |

---

## 3. Object-Level Scoping Rules

1. **Field Worker Scope**:
   - Field Workers only have visibility and mutation rights over tasks where `tasks.assigned_to = auth.uid()`.
   - Field Workers cannot see unassigned tasks or tasks assigned to other colleagues.
2. **Supervisor Scope**:
   - Supervisors can view and manage tasks assigned to members of teams the supervisor is assigned to, or tasks explicitly assigned to the supervisor's team (`tasks.assigned_team IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())`).
3. **Manager / Admin / Owner Scope**:
   - Full organization-wide visibility across all teams and technicians within the tenant.
