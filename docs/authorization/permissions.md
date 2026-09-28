# FieldOps — Granular Permission Primitives & can() Evaluation

---

## 1. Granular Capability Strings

Permissions are structured as deterministic capability strings under `@fieldops/types`:

```typescript
export const Permissions = {
  // Organization & Settings
  ORG_SETTINGS_VIEW: 'org:settings:view',
  ORG_SETTINGS_EDIT: 'org:settings:edit',
  ORG_BILLING_VIEW: 'org:billing:view',
  ORG_BILLING_MANAGE: 'org:billing:manage',
  ORG_DELETE: 'org:delete',

  // Membership & Access
  MEMBER_INVITE: 'member:invite',
  MEMBER_DEACTIVATE: 'member:deactivate',
  MEMBER_ROLE_ASSIGN: 'member:role:assign',
  MEMBER_PROFILE_VIEW_ALL: 'member:profile:view:all',
  MEMBER_PROFILE_VIEW_TEAM: 'member:profile:view:team',
  MEMBER_PROFILE_VIEW_OWN: 'member:profile:view:own',

  // Teams & Locations
  TEAM_MANAGE: 'team:manage',
  TEAM_ASSIGN: 'team:assign',
  LOCATION_MANAGE: 'location:manage',
  LOCATION_DELETE: 'location:delete',
  LOCATION_VIEW_ALL: 'location:view:all',
  LOCATION_VIEW_TEAM: 'location:view:team',
  LOCATION_VIEW_OWN: 'location:view:own',

  // Tasks
  TASK_CREATE: 'task:create',
  TASK_ASSIGN: 'task:assign',
  TASK_UPDATE_ANY: 'task:update:any',
  TASK_UPDATE_TEAM: 'task:update:team',
  TASK_UPDATE_OWN: 'task:update:own',
  TASK_APPROVE: 'task:approve',
  TASK_DELETE: 'task:delete',
  TASK_VIEW_ALL: 'task:view:all',
  TASK_VIEW_TEAM: 'task:view:team',
  TASK_VIEW_OWN: 'task:view:own',

  // Visits & Attendance
  VISIT_SCHEDULE: 'visit:schedule',
  VISIT_CANCEL: 'visit:cancel',
  VISIT_CHECKIN_OWN: 'visit:checkin:own',
  VISIT_GEOFENCE_OVERRIDE: 'visit:geofence_override',
  VISIT_VIEW_ALL: 'visit:view:all',
  VISIT_VIEW_TEAM: 'visit:view:team',
  VISIT_VIEW_OWN: 'visit:view:own',
  ATTENDANCE_CLOCK_OWN: 'attendance:clock:own',
  ATTENDANCE_VIEW_ORG: 'attendance:view:org',
  ATTENDANCE_VIEW_TEAM: 'attendance:view:team',
  ATTENDANCE_ADJUST: 'attendance:adjust',

  // Audit
  AUDIT_VIEW: 'audit:view',
} as const;
```

---

## 2. Centralized Evaluation Engine (`can()`)

The `can()` function evaluates nominal capabilities alongside contextual object-level constraints:

```typescript
export function can(
  role: UserRole,
  permission: Permission,
  context?: ResourceContext
): boolean;
```

### Context Evaluation Rules:
1. **Nominal Capability**: First checks `ROLE_PERMISSIONS[role].includes(permission)`. If false, immediately returns `false`.
2. **Owner Demotion Protection**: If `role === ADMIN` and `permission === MEMBER_ROLE_ASSIGN` and `context.targetRole === OWNER`, returns `false`.
3. **Owner Deactivation Protection**: If `role === ADMIN` and `permission === MEMBER_DEACTIVATE` and `context.targetRole === OWNER`, returns `false`.
4. **Supervisor Team Scoping**: For team operations, verifies `context.actorTeamIds.includes(context.teamId)`.
5. **Field Worker Self-Scoping**: For own records, verifies `context.actorId === context.assigneeId`.
