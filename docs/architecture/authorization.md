# FieldOps — Authorization & Role-Based Access Control (RBAC)

---

## 1. Authorization Philosophy

In FieldOps, authorization decisions are **strictly organization-scoped**. A user account does not possess a global system role; rather, their permissions are bound to a specific **Membership** within an **Organization**.

```
User Account
  └── Organization Membership (tenant_id)
        └── System Role (OWNER | ADMIN | MANAGER | SUPERVISOR | FIELD_WORKER)
              └── Granular Permissions (can_create_task, can_assign_task, etc.)
```

---

## 2. Organization-Scoped System Roles

FieldOps defines five deterministic system roles within each tenant:

1. **Owner (`OWNER`)**:
   - Master account owner.
   - Exclusive authority over billing instruments, subscription plans, and tenant deletion.
2. **Admin (`ADMIN`)**:
   - Organization administrator.
   - Authority over employee onboarding/offboarding, role assignment, location registers, and audit logs.
3. **Manager (`MANAGER`)**:
   - Operations lead.
   - Cross-team dispatch authority, SLA performance visibility, exception overrides, and schedule management.
4. **Supervisor (`SUPERVISOR`)**:
   - Frontline field team lead.
   - Authority scoped strictly to **assigned teams**; oversees technician check-ins, approves proofs, and triages blockers.
5. **Field Worker (`FIELD_WORKER`)**:
   - Mobile field specialist.
   - Scoped strictly to **own assigned work**; executes tasks, performs geofenced check-ins, logs attendance, and submits proof.

---

## 3. Permission Primitives

Granular permissions are modeled as capability strings evaluated by server-side authorization middleware:

```typescript
export const Permissions = {
  // Task Operations
  CAN_CREATE_TASK: 'task:create',
  CAN_ASSIGN_TASK: 'task:assign',
  CAN_UPDATE_ANY_TASK: 'task:update:any',
  CAN_UPDATE_OWN_TASK: 'task:update:own',
  CAN_APPROVE_TASK: 'task:approve',

  // Visit & Geofence Operations
  CAN_SCHEDULE_VISIT: 'visit:schedule',
  CAN_OVERRIDE_GEOFENCE: 'visit:geofence_override',

  // Workforce & Attendance
  CAN_VIEW_TEAM_ATTENDANCE: 'attendance:view:team',
  CAN_VIEW_ORG_ATTENDANCE: 'attendance:view:org',
  CAN_ADJUST_ATTENDANCE: 'attendance:adjust',

  // Management & Administration
  CAN_MANAGE_LOCATIONS: 'location:manage',
  CAN_MANAGE_MEMBERS: 'member:manage',
  CAN_VIEW_AUDIT_LOGS: 'audit:view',
  CAN_MANAGE_BILLING: 'billing:manage',
} as const;
```

---

## 4. Server-Side Enforcement Rules

1. **Cosmetic Client Toggles**: Disabling buttons or hiding routes on Web/Mobile is solely for user ergonomics. All API routes independently check:
   ```typescript
   if (!hasPermission(currentUser, Permissions.CAN_CREATE_TASK)) {
     throw new ApiClientError({
       code: ErrorCode.AUTHORIZATION_ERROR,
       message: 'User lacks task:create permission',
       request_id: requestId,
     }, 403);
   }
   ```
2. **Object-Level Authorization**:
   - A `Field Worker` querying `/api/v1/tasks/:id` must satisfy `task.assignee_id == currentUser.id`.
   - A `Supervisor` updating `/api/v1/tasks/:id` must satisfy `task.team_id IN currentUser.supervised_team_ids`.
3. **Auditability**: Every privileged override (e.g. `visit:geofence_override` or `attendance:adjust`) records the actor's ID and mandatory reason into `audit_logs`.
