# Web Operations Console Permission & RBAC Matrix

## 1. Governance Principles

All authorization decisions in FieldOps are server-authoritative. Frontend UI permission checks (using `can(role, Permissions.<ACTION>)`) are **UX-only visual controls** that prevent frustration and declutter menus. Even if a client circumvents frontend controls, server-side RLS and service validation strictly reject unauthorized operations.

---

## 2. Route & Screen Access Matrix

| Route | Minimum Permitted Role | Controlling Permission | Unauthorized Behavior |
| :--- | :--- | :--- | :--- |
| `/dashboard` | `FIELD_WORKER` | Contextual (Own workload vs Org KPIs) | Workers see personal assigned metrics; Supervisors+ see Org/Team KPIs. |
| `/tasks` | `FIELD_WORKER` | `TASK_VIEW_OWN` | Workers see assigned tasks; Managers/Admins see all tenant tasks. |
| `/tasks/[id]` | `FIELD_WORKER` | `TASK_VIEW_OWN` | 403 Forbidden if not assigned / not in tenant. |
| `/visits` | `FIELD_WORKER` | `VISIT_VIEW_OWN` | Workers see assigned visits; Managers/Admins see all visits. |
| `/visits/[id]` | `FIELD_WORKER` | `VISIT_VIEW_OWN` | 403 Forbidden if not assigned / not in tenant. |
| `/calendar` | `FIELD_WORKER` | `TASK_VIEW_OWN` / `VISIT_VIEW_OWN` | Filtered to own assignments for workers; org-wide for supervisors/admins. |
| `/map` | `SUPERVISOR` | `LOCATION_VIEW_ALL` | Redirected to `/dashboard` if field worker attempts direct access. |
| `/employees` | `SUPERVISOR` | `MEMBER_PROFILE_VIEW_TEAM` | Redirection to `/dashboard` if field worker attempts direct access. |
| `/teams` | `SUPERVISOR` | `TEAM_MANAGE` / `TEAM_ASSIGN` | Restricted to supervisors, managers, admins, and owners. |
| `/attendance` | `FIELD_WORKER` | `ATTENDANCE_CLOCK_OWN` | Workers view own records; Managers/Admins view org records and adjust. |
| `/activity` | `SUPERVISOR` | `ATTENDANCE_VIEW_TEAM` | Restricted to supervisors, managers, admins, and owners. |
| `/organization/members` | `ADMIN` | `MEMBER_INVITE` | Restricted to Admin & Owner. |

---

## 3. Operational Action Authority

| Action | Allowed Roles | Prohibited Roles |
| :--- | :--- | :--- |
| **Create Task** | `SUPERVISOR`, `MANAGER`, `ADMIN`, `OWNER` | `FIELD_WORKER` |
| **Assign Task** | `SUPERVISOR`, `MANAGER`, `ADMIN`, `OWNER` | `FIELD_WORKER` |
| **Cancel Task** | `SUPERVISOR`, `MANAGER`, `ADMIN`, `OWNER` | `FIELD_WORKER` |
| **Schedule Visit** | `SUPERVISOR`, `MANAGER`, `ADMIN`, `OWNER` | `FIELD_WORKER` |
| **Override Geofence** | `SUPERVISOR`, `MANAGER`, `ADMIN`, `OWNER` | `FIELD_WORKER` |
| **Adjust Attendance** | `MANAGER`, `ADMIN`, `OWNER` | `FIELD_WORKER`, `SUPERVISOR` |
| **Create Team** | `ADMIN`, `OWNER`, `MANAGER` | `FIELD_WORKER` |
| **Invite Member** | `ADMIN`, `OWNER` | `FIELD_WORKER`, `SUPERVISOR`, `MANAGER` |
