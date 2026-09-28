import { describe, it, expect } from 'vitest';
import {
  UserRole,
  Permissions,
  can,
  hasPermission,
  UserId,
  TeamId,
} from '@fieldops/types';

describe('Security Suite: Role Privilege Boundary & Escalation Defense', () => {
  describe('FIELD_WORKER Boundary Enforcement', () => {
    it('prohibits Field Worker from inviting new members', () => {
      expect(hasPermission(UserRole.FIELD_WORKER, Permissions.MEMBER_INVITE)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.MEMBER_INVITE)).toBe(false);
    });

    it('prohibits Field Worker from viewing audit logs', () => {
      expect(hasPermission(UserRole.FIELD_WORKER, Permissions.AUDIT_VIEW)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.AUDIT_VIEW)).toBe(false);
    });

    it('prohibits Field Worker from changing tenant settings or billing', () => {
      expect(hasPermission(UserRole.FIELD_WORKER, Permissions.ORG_SETTINGS_EDIT)).toBe(false);
      expect(hasPermission(UserRole.FIELD_WORKER, Permissions.ORG_BILLING_VIEW)).toBe(false);
      expect(hasPermission(UserRole.FIELD_WORKER, Permissions.ORG_BILLING_MANAGE)).toBe(false);
    });

    it('denies Field Worker access to another technician’s tasks', () => {
      const myId = 'worker-101' as UserId;
      const otherId = 'worker-999' as UserId;

      expect(
        can(UserRole.FIELD_WORKER, Permissions.TASK_VIEW_OWN, {
          actorId: myId,
          assigneeId: otherId,
        })
      ).toBe(false);
    });
  });

  describe('SUPERVISOR Boundary Enforcement', () => {
    it('prohibits Supervisor from modifying organization settings or billing', () => {
      expect(hasPermission(UserRole.SUPERVISOR, Permissions.ORG_SETTINGS_EDIT)).toBe(false);
      expect(hasPermission(UserRole.SUPERVISOR, Permissions.ORG_BILLING_VIEW)).toBe(false);
    });

    it('prohibits Supervisor from inviting members', () => {
      expect(hasPermission(UserRole.SUPERVISOR, Permissions.MEMBER_INVITE)).toBe(false);
    });

    it('denies Supervisor from modifying tasks of teams they do not supervise', () => {
      const teamAssigned = 'team-alpha' as TeamId;
      const teamForeign = 'team-beta' as TeamId;

      expect(
        can(UserRole.SUPERVISOR, Permissions.TASK_UPDATE_TEAM, {
          teamId: teamForeign,
          actorTeamIds: [teamAssigned],
        })
      ).toBe(false);
    });
  });

  describe('MANAGER Boundary Enforcement', () => {
    it('prohibits Manager from inviting members, deleting org, or managing billing', () => {
      expect(hasPermission(UserRole.MANAGER, Permissions.MEMBER_INVITE)).toBe(false);
      expect(hasPermission(UserRole.MANAGER, Permissions.ORG_DELETE)).toBe(false);
      expect(hasPermission(UserRole.MANAGER, Permissions.ORG_BILLING_MANAGE)).toBe(false);
      expect(hasPermission(UserRole.MANAGER, Permissions.AUDIT_VIEW)).toBe(false);
    });
  });

  describe('ADMIN vs OWNER Privilege Escalation Defense', () => {
    it('strictly prohibits Admin from deleting the organization', () => {
      expect(hasPermission(UserRole.ADMIN, Permissions.ORG_DELETE)).toBe(false);
      expect(can(UserRole.ADMIN, Permissions.ORG_DELETE)).toBe(false);
    });

    it('strictly prohibits Admin from managing billing instruments', () => {
      expect(hasPermission(UserRole.ADMIN, Permissions.ORG_BILLING_MANAGE)).toBe(false);
      expect(can(UserRole.ADMIN, Permissions.ORG_BILLING_MANAGE)).toBe(false);
    });

    it('prohibits Admin from promoting anyone to OWNER', () => {
      expect(
        can(UserRole.ADMIN, Permissions.MEMBER_ROLE_ASSIGN, {
          targetRole: UserRole.OWNER,
        })
      ).toBe(false);
    });

    it('prohibits Admin from deactivating an OWNER', () => {
      expect(
        can(UserRole.ADMIN, Permissions.MEMBER_DEACTIVATE, {
          targetRole: UserRole.OWNER,
        })
      ).toBe(false);
    });

    it('allows Owner exclusive right to transfer or assign OWNER role and delete organization', () => {
      expect(
        can(UserRole.OWNER, Permissions.MEMBER_ROLE_ASSIGN, {
          targetRole: UserRole.OWNER,
        })
      ).toBe(true);
      expect(can(UserRole.OWNER, Permissions.ORG_DELETE)).toBe(true);
    });
  });
});
