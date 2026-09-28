import { describe, it, expect } from 'vitest';
import {
  UserRole,
  Permissions,
  can,
  hasPermission,
  ROLE_PERMISSIONS,
  UserId,
  TeamId,
} from '../src/index';

describe('Role Capability Matrix & can() Authorization Engine', () => {
  it('validates OWNER has broad administrative and destructive permissions', () => {
    expect(hasPermission(UserRole.OWNER, Permissions.ORG_DELETE)).toBe(true);
    expect(hasPermission(UserRole.OWNER, Permissions.ORG_BILLING_MANAGE)).toBe(true);
    expect(hasPermission(UserRole.OWNER, Permissions.MEMBER_INVITE)).toBe(true);
    expect(hasPermission(UserRole.OWNER, Permissions.AUDIT_VIEW)).toBe(true);
    expect(can(UserRole.OWNER, Permissions.ORG_DELETE)).toBe(true);
  });

  it('validates ADMIN cannot delete organization or manage billing instruments', () => {
    expect(hasPermission(UserRole.ADMIN, Permissions.ORG_DELETE)).toBe(false);
    expect(hasPermission(UserRole.ADMIN, Permissions.ORG_BILLING_MANAGE)).toBe(false);
    expect(hasPermission(UserRole.ADMIN, Permissions.MEMBER_INVITE)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, Permissions.AUDIT_VIEW)).toBe(true);
    expect(can(UserRole.ADMIN, Permissions.ORG_DELETE)).toBe(false);
  });

  it('validates ADMIN cannot assign OWNER role or deactivate an OWNER', () => {
    expect(
      can(UserRole.ADMIN, Permissions.MEMBER_ROLE_ASSIGN, {
        targetRole: UserRole.OWNER,
      })
    ).toBe(false);

    expect(
      can(UserRole.ADMIN, Permissions.MEMBER_DEACTIVATE, {
        targetRole: UserRole.OWNER,
      })
    ).toBe(false);

    // But ADMIN can assign MANAGER or FIELD_WORKER
    expect(
      can(UserRole.ADMIN, Permissions.MEMBER_ROLE_ASSIGN, {
        targetRole: UserRole.FIELD_WORKER,
      })
    ).toBe(true);
  });

  it('validates MANAGER cannot invite users, manage billing, or view audit logs', () => {
    expect(hasPermission(UserRole.MANAGER, Permissions.MEMBER_INVITE)).toBe(false);
    expect(hasPermission(UserRole.MANAGER, Permissions.ORG_BILLING_VIEW)).toBe(false);
    expect(hasPermission(UserRole.MANAGER, Permissions.AUDIT_VIEW)).toBe(false);
    expect(hasPermission(UserRole.MANAGER, Permissions.TASK_CREATE)).toBe(true);
    expect(hasPermission(UserRole.MANAGER, Permissions.LOCATION_MANAGE)).toBe(true);
  });

  it('validates SUPERVISOR authority is scoped to assigned teams', () => {
    const teamA = 'team-a' as TeamId;
    const teamB = 'team-b' as TeamId;

    expect(hasPermission(UserRole.SUPERVISOR, Permissions.TASK_UPDATE_TEAM)).toBe(true);
    expect(hasPermission(UserRole.SUPERVISOR, Permissions.ORG_SETTINGS_VIEW)).toBe(false);

    // Can access their own supervised team
    expect(
      can(UserRole.SUPERVISOR, Permissions.TASK_UPDATE_TEAM, {
        teamId: teamA,
        actorTeamIds: [teamA],
      })
    ).toBe(true);

    // Cannot access a team they do not supervise
    expect(
      can(UserRole.SUPERVISOR, Permissions.TASK_UPDATE_TEAM, {
        teamId: teamB,
        actorTeamIds: [teamA],
      })
    ).toBe(false);
  });

  it('validates FIELD_WORKER authority is scoped strictly to own records', () => {
    const worker1 = 'worker-1' as UserId;
    const worker2 = 'worker-2' as UserId;

    expect(hasPermission(UserRole.FIELD_WORKER, Permissions.TASK_VIEW_ALL)).toBe(false);
    expect(hasPermission(UserRole.FIELD_WORKER, Permissions.TASK_VIEW_TEAM)).toBe(false);
    expect(hasPermission(UserRole.FIELD_WORKER, Permissions.TASK_VIEW_OWN)).toBe(true);

    // Can view own task
    expect(
      can(UserRole.FIELD_WORKER, Permissions.TASK_VIEW_OWN, {
        actorId: worker1,
        assigneeId: worker1,
      })
    ).toBe(true);

    // Cannot view another worker's task
    expect(
      can(UserRole.FIELD_WORKER, Permissions.TASK_VIEW_OWN, {
        actorId: worker1,
        assigneeId: worker2,
      })
    ).toBe(false);
  });

  it('ensures all 5 roles have defined entries in ROLE_PERMISSIONS matrix', () => {
    const roles = Object.values(UserRole);
    for (const role of roles) {
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });
});
