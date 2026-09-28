import { describe, it, expect, vi } from 'vitest';
import {
  can,
  hasPermission,
  Permissions,
  UserRole,
  VisitStatus,
  isValidVisitTransition,
  ErrorCode,
  VisitId,
  LocationId,
  TeamId,
  UserId,
} from '@fieldops/types';
import { FieldOpsApiClient, VisitService, LocationService } from '@fieldops/api';

describe('Security Suite: Field Operations RBAC Boundaries & Capability Matrix', () => {
  describe('Static Capability Matrix & can() Evaluator', () => {
    it('strictly forbids Field Workers from managing or deleting locations', () => {
      expect(hasPermission(UserRole.FIELD_WORKER, Permissions.LOCATION_MANAGE)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.LOCATION_MANAGE)).toBe(false);

      expect(hasPermission(UserRole.FIELD_WORKER, Permissions.LOCATION_DELETE)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.LOCATION_DELETE)).toBe(false);
    });

    it('strictly forbids Field Workers from scheduling or canceling visits', () => {
      expect(hasPermission(UserRole.FIELD_WORKER, Permissions.VISIT_SCHEDULE)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.VISIT_SCHEDULE)).toBe(false);

      expect(hasPermission(UserRole.FIELD_WORKER, Permissions.VISIT_CANCEL)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.VISIT_CANCEL)).toBe(false);
    });

    it('strictly forbids Field Workers from approving geofence overrides', () => {
      expect(hasPermission(UserRole.FIELD_WORKER, Permissions.VISIT_GEOFENCE_OVERRIDE)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.VISIT_GEOFENCE_OVERRIDE)).toBe(false);
    });

    it('restricts Field Workers to viewing and operating only on their own assigned visits', () => {
      const workerId = '00000000-0000-0000-0000-000000000001' as UserId;
      const otherWorkerId = '00000000-0000-0000-0000-000000000002' as UserId;

      expect(can(UserRole.FIELD_WORKER, Permissions.VISIT_VIEW_ALL)).toBe(false);

      // Can view own assigned visit
      expect(
        can(UserRole.FIELD_WORKER, Permissions.VISIT_VIEW_OWN, {
          actorId: workerId,
          assigneeId: workerId,
        })
      ).toBe(true);

      // Cannot view other worker's visit
      expect(
        can(UserRole.FIELD_WORKER, Permissions.VISIT_VIEW_OWN, {
          actorId: workerId,
          assigneeId: otherWorkerId,
        })
      ).toBe(false);

      // Can check in to own assigned visit
      expect(
        can(UserRole.FIELD_WORKER, Permissions.VISIT_CHECKIN_OWN, {
          actorId: workerId,
          assigneeId: workerId,
        })
      ).toBe(true);

      // Cannot check in to another worker's visit
      expect(
        can(UserRole.FIELD_WORKER, Permissions.VISIT_CHECKIN_OWN, {
          actorId: workerId,
          assigneeId: otherWorkerId,
        })
      ).toBe(false);
    });

    it('prohibits Supervisors from managing organization-wide locations', () => {
      expect(hasPermission(UserRole.SUPERVISOR, Permissions.LOCATION_MANAGE)).toBe(false);
      expect(can(UserRole.SUPERVISOR, Permissions.LOCATION_MANAGE)).toBe(false);
    });

    it('allows Supervisors to schedule visits, cancel visits, and override geofences within their authority', () => {
      expect(hasPermission(UserRole.SUPERVISOR, Permissions.VISIT_SCHEDULE)).toBe(true);
      expect(can(UserRole.SUPERVISOR, Permissions.VISIT_SCHEDULE)).toBe(true);

      expect(hasPermission(UserRole.SUPERVISOR, Permissions.VISIT_CANCEL)).toBe(true);
      expect(can(UserRole.SUPERVISOR, Permissions.VISIT_CANCEL)).toBe(true);

      expect(hasPermission(UserRole.SUPERVISOR, Permissions.VISIT_GEOFENCE_OVERRIDE)).toBe(true);
      expect(can(UserRole.SUPERVISOR, Permissions.VISIT_GEOFENCE_OVERRIDE)).toBe(true);
    });

    it('restricts Supervisors to their assigned teams for visit inspection', () => {
      const myTeam = '00000000-0000-0000-0000-000000000010' as TeamId;
      const otherTeam = '00000000-0000-0000-0000-000000000020' as TeamId;

      expect(
        can(UserRole.SUPERVISOR, Permissions.VISIT_VIEW_TEAM, {
          teamId: myTeam,
          actorTeamIds: [myTeam],
        })
      ).toBe(true);

      expect(
        can(UserRole.SUPERVISOR, Permissions.VISIT_VIEW_TEAM, {
          teamId: otherTeam,
          actorTeamIds: [myTeam],
        })
      ).toBe(false);
    });

    it('allows Managers and Admins full visit and location management authority', () => {
      for (const role of [UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER]) {
        expect(hasPermission(role, Permissions.LOCATION_MANAGE)).toBe(true);
        expect(hasPermission(role, Permissions.VISIT_SCHEDULE)).toBe(true);
        expect(hasPermission(role, Permissions.VISIT_CANCEL)).toBe(true);
        expect(hasPermission(role, Permissions.VISIT_VIEW_ALL)).toBe(true);
        expect(hasPermission(role, Permissions.VISIT_GEOFENCE_OVERRIDE)).toBe(true);
      }
    });
  });

  describe('Visit Lifecycle State Machine RBAC & Rule Enforcement', () => {
    it('strictly forbids Field Workers from canceling visits', () => {
      const transition = isValidVisitTransition(
        VisitStatus.SCHEDULED,
        VisitStatus.CANCELED,
        UserRole.FIELD_WORKER
      );
      expect(transition.valid).toBe(false);
      expect(transition.reason).toContain('Field Workers cannot cancel visits');
    });

    it('allows Supervisors and Admins to cancel visits', () => {
      const supervisorCancel = isValidVisitTransition(
        VisitStatus.SCHEDULED,
        VisitStatus.CANCELED,
        UserRole.SUPERVISOR
      );
      expect(supervisorCancel.valid).toBe(true);

      const adminCancel = isValidVisitTransition(
        VisitStatus.IN_PROGRESS,
        VisitStatus.CANCELED,
        UserRole.ADMIN
      );
      expect(adminCancel.valid).toBe(true);
    });

    it('treats COMPLETED and CANCELED as terminal states that cannot transition', () => {
      const fromCompleted = isValidVisitTransition(
        VisitStatus.COMPLETED,
        VisitStatus.IN_PROGRESS,
        UserRole.ADMIN
      );
      expect(fromCompleted.valid).toBe(false);
      expect(fromCompleted.reason).toContain('terminal state');

      const fromCanceled = isValidVisitTransition(
        VisitStatus.CANCELED,
        VisitStatus.SCHEDULED,
        UserRole.ADMIN
      );
      expect(fromCanceled.valid).toBe(false);
      expect(fromCanceled.reason).toContain('terminal state');
    });

    it('prevents direct completion from SCHEDULED or CHECKED_IN without CHECKED_OUT step', () => {
      const jumpFromScheduled = isValidVisitTransition(
        VisitStatus.SCHEDULED,
        VisitStatus.COMPLETED,
        UserRole.FIELD_WORKER
      );
      expect(jumpFromScheduled.valid).toBe(false);

      const jumpFromCheckedIn = isValidVisitTransition(
        VisitStatus.CHECKED_IN,
        VisitStatus.COMPLETED,
        UserRole.FIELD_WORKER
      );
      expect(jumpFromCheckedIn.valid).toBe(false);
    });

    it('strictly forbids completion if checkout has not been recorded', () => {
      const completionAttempt = isValidVisitTransition(
        VisitStatus.CHECKED_OUT,
        VisitStatus.COMPLETED,
        UserRole.FIELD_WORKER,
        { hasCheckout: false }
      );
      expect(completionAttempt.valid).toBe(false);
      expect(completionAttempt.reason).toContain('Cannot complete visit without recording check-out');
    });

    it('strictly forbids completion if required proofs have not been submitted', () => {
      const proofGatedAttempt = isValidVisitTransition(
        VisitStatus.CHECKED_OUT,
        VisitStatus.COMPLETED,
        UserRole.FIELD_WORKER,
        {
          hasCheckout: true,
          requiredProofCount: 2,
          proofCount: 1,
        }
      );
      expect(proofGatedAttempt.valid).toBe(false);
      expect(proofGatedAttempt.reason).toContain('required 2 proof(s), but only 1 provided');

      const validAttempt = isValidVisitTransition(
        VisitStatus.CHECKED_OUT,
        VisitStatus.COMPLETED,
        UserRole.FIELD_WORKER,
        {
          hasCheckout: true,
          requiredProofCount: 2,
          proofCount: 2,
        }
      );
      expect(validAttempt.valid).toBe(true);
    });
  });

  describe('API Layer RBAC Enforcement', () => {
    it('returns 403 when a Field Worker attempts to schedule a visit', async () => {
      const customFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          error: {
            code: ErrorCode.VISIT_ACCESS_DENIED,
            message: 'Field workers do not possess visit:schedule permission.',
            request_id: 'req_rbac_visit_001',
          },
        }),
      });

      const client = new FieldOpsApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: customFetch as unknown as typeof fetch,
        maxRetries: 0,
      });
      const visitService = new VisitService(client);

      await expect(
        visitService.createVisit({
          title: 'Unauthorized Schedule Attempt',
          locationId: '00000000-0000-0000-0000-000000000001' as LocationId,
          scheduledStart: '2026-09-29T09:00:00.000Z',
        })
      ).rejects.toThrowError(
        expect.objectContaining({
          status: 403,
          detail: expect.objectContaining({
            code: ErrorCode.VISIT_ACCESS_DENIED,
          }),
        })
      );
    });

    it('returns 403 when a Field Worker attempts to archive a location', async () => {
      const customFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          error: {
            code: ErrorCode.LOCATION_ACCESS_DENIED,
            message: 'Field workers do not possess location:manage permission.',
            request_id: 'req_rbac_loc_002',
          },
        }),
      });

      const client = new FieldOpsApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: customFetch as unknown as typeof fetch,
        maxRetries: 0,
      });
      const locationService = new LocationService(client);

      await expect(
        locationService.archiveLocation('00000000-0000-0000-0000-000000000001' as LocationId)
      ).rejects.toThrowError(
        expect.objectContaining({
          status: 403,
          detail: expect.objectContaining({
            code: ErrorCode.LOCATION_ACCESS_DENIED,
          }),
        })
      );
    });
  });
});
