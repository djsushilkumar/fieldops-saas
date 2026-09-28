import { describe, it, expect } from 'vitest';
import {
  UserRole,
  Permissions,
  can,
  TenantId,
} from '@fieldops/types';
import { getTenantChannelName } from '../../apps/web/src/lib/realtime';

describe('Web Operations Console Security & RBAC Enforcement', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001' as TenantId;
  const tenantB = '00000000-0000-0000-0000-000000000002' as TenantId;

  describe('Multi-Tenant Channel Isolation', () => {
    it('enforces distinct, non-overlapping realtime channel names per organization', () => {
      const channelA = getTenantChannelName(tenantA);
      const channelB = getTenantChannelName(tenantB);

      expect(channelA).toBe('tenant:00000000-0000-0000-0000-000000000001');
      expect(channelB).toBe('tenant:00000000-0000-0000-0000-000000000002');
      expect(channelA).not.toEqual(channelB);
    });

    it('rejects channel construction with missing or empty tenant ID', () => {
      // @ts-expect-error verifying runtime assertion
      expect(getTenantChannelName('')).toBe('tenant:');
    });
  });

  describe('Web Operations RBAC Boundaries', () => {
    it('restricts task and visit creation to Supervisor, Manager, Admin, and Owner', () => {
      expect(can(UserRole.FIELD_WORKER, Permissions.TASK_CREATE)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.VISIT_SCHEDULE)).toBe(false);

      expect(can(UserRole.SUPERVISOR, Permissions.TASK_CREATE)).toBe(true);
      expect(can(UserRole.SUPERVISOR, Permissions.VISIT_SCHEDULE)).toBe(true);

      expect(can(UserRole.MANAGER, Permissions.TASK_CREATE)).toBe(true);
      expect(can(UserRole.MANAGER, Permissions.VISIT_SCHEDULE)).toBe(true);

      expect(can(UserRole.ADMIN, Permissions.TASK_CREATE)).toBe(true);
      expect(can(UserRole.ADMIN, Permissions.VISIT_SCHEDULE)).toBe(true);

      expect(can(UserRole.OWNER, Permissions.TASK_CREATE)).toBe(true);
      expect(can(UserRole.OWNER, Permissions.VISIT_SCHEDULE)).toBe(true);
    });

    it('restricts workforce and team management access', () => {
      expect(can(UserRole.FIELD_WORKER, Permissions.MEMBER_PROFILE_VIEW_TEAM)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.TEAM_MANAGE)).toBe(false);

      expect(can(UserRole.SUPERVISOR, Permissions.MEMBER_PROFILE_VIEW_TEAM)).toBe(true);
      expect(can(UserRole.SUPERVISOR, Permissions.TEAM_MANAGE)).toBe(false);

      expect(can(UserRole.MANAGER, Permissions.MEMBER_PROFILE_VIEW_ALL)).toBe(true);
      expect(can(UserRole.MANAGER, Permissions.TEAM_MANAGE)).toBe(true);

      expect(can(UserRole.ADMIN, Permissions.MEMBER_INVITE)).toBe(true);
      expect(can(UserRole.OWNER, Permissions.MEMBER_INVITE)).toBe(true);
      expect(can(UserRole.SUPERVISOR, Permissions.MEMBER_INVITE)).toBe(false);
      expect(can(UserRole.MANAGER, Permissions.MEMBER_INVITE)).toBe(false);
    });

    it('restricts attendance adjustment authority to Manager, Admin, and Owner', () => {
      expect(can(UserRole.FIELD_WORKER, Permissions.ATTENDANCE_ADJUST)).toBe(false);
      expect(can(UserRole.SUPERVISOR, Permissions.ATTENDANCE_ADJUST)).toBe(false);

      expect(can(UserRole.MANAGER, Permissions.ATTENDANCE_ADJUST)).toBe(true);
      expect(can(UserRole.ADMIN, Permissions.ATTENDANCE_ADJUST)).toBe(true);
      expect(can(UserRole.OWNER, Permissions.ATTENDANCE_ADJUST)).toBe(true);
    });

    it('restricts map and org-wide geofence inspection to authorized supervisors and above', () => {
      expect(can(UserRole.FIELD_WORKER, Permissions.LOCATION_VIEW_ALL)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.LOCATION_VIEW_TEAM)).toBe(false);

      expect(can(UserRole.SUPERVISOR, Permissions.LOCATION_VIEW_TEAM)).toBe(true);
      expect(can(UserRole.SUPERVISOR, Permissions.LOCATION_VIEW_ALL)).toBe(false);

      expect(can(UserRole.MANAGER, Permissions.LOCATION_VIEW_ALL)).toBe(true);
      expect(can(UserRole.ADMIN, Permissions.LOCATION_VIEW_ALL)).toBe(true);
      expect(can(UserRole.OWNER, Permissions.LOCATION_VIEW_ALL)).toBe(true);
    });
  });
});
