import { describe, it, expect, vi } from 'vitest';
import {
  can,
  hasPermission,
  Permissions,
  UserRole,
  TaskStatus,
  isValidTaskTransition,
  ErrorCode,
  TaskId,
  TeamId,
  UserId,
} from '@fieldops/types';
import { FieldOpsApiClient, TaskService } from '@fieldops/api';

describe('Security Suite: Task RBAC Authority & Capability Matrix Boundaries', () => {
  describe('Static Capability Matrix & can() evaluator', () => {
    it('prohibits Field Workers from creating tasks', () => {
      expect(hasPermission(UserRole.FIELD_WORKER, Permissions.TASK_CREATE)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.TASK_CREATE)).toBe(false);
    });

    it('prohibits Field Workers from deleting or assigning tasks', () => {
      expect(can(UserRole.FIELD_WORKER, Permissions.TASK_DELETE)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.TASK_ASSIGN)).toBe(false);
    });

    it('restricts Field Workers to viewing only their own assigned tasks', () => {
      const workerId = '00000000-0000-0000-0000-000000000001' as UserId;
      const otherWorkerId = '00000000-0000-0000-0000-000000000002' as UserId;

      expect(
        can(UserRole.FIELD_WORKER, Permissions.TASK_VIEW_OWN, {
          actorId: workerId,
          assigneeId: workerId,
        })
      ).toBe(true);

      expect(
        can(UserRole.FIELD_WORKER, Permissions.TASK_VIEW_OWN, {
          actorId: workerId,
          assigneeId: otherWorkerId,
        })
      ).toBe(false);

      expect(can(UserRole.FIELD_WORKER, Permissions.TASK_VIEW_ALL)).toBe(false);
    });

    it('restricts Supervisors to their assigned teams', () => {
      const myTeam = '00000000-0000-0000-0000-000000000010' as TeamId;
      const otherTeam = '00000000-0000-0000-0000-000000000020' as TeamId;

      expect(
        can(UserRole.SUPERVISOR, Permissions.TASK_VIEW_TEAM, {
          teamId: myTeam,
          actorTeamIds: [myTeam],
        })
      ).toBe(true);

      expect(
        can(UserRole.SUPERVISOR, Permissions.TASK_VIEW_TEAM, {
          teamId: otherTeam,
          actorTeamIds: [myTeam],
        })
      ).toBe(false);
    });
  });

  describe('Lifecycle State Machine Transitions', () => {
    it('strictly forbids Field Workers from canceling tasks', () => {
      const transition = isValidTaskTransition(
        TaskStatus.IN_PROGRESS,
        TaskStatus.CANCELED,
        UserRole.FIELD_WORKER
      );
      expect(transition.valid).toBe(false);
      expect(transition.reason).toContain('Field Workers cannot cancel tasks');
    });

    it('strictly forbids Field Workers from reopening completed tasks', () => {
      const transition = isValidTaskTransition(
        TaskStatus.COMPLETED,
        TaskStatus.IN_PROGRESS,
        UserRole.FIELD_WORKER
      );
      expect(transition.valid).toBe(false);
      expect(transition.reason).toContain('Field Workers cannot reopen completed tasks');
    });

    it('strictly prohibits completing tasks when mandatory checklist items remain incomplete', () => {
      const transition = isValidTaskTransition(
        TaskStatus.IN_PROGRESS,
        TaskStatus.COMPLETED,
        UserRole.FIELD_WORKER,
        { incompleteRequiredChecklists: 1 }
      );
      expect(transition.valid).toBe(false);
      expect(transition.reason).toContain('unfinished required checklist items');
    });

    it('forbids skipping lifecycle phases (e.g. DRAFT -> COMPLETED)', () => {
      const transition = isValidTaskTransition(
        TaskStatus.DRAFT,
        TaskStatus.COMPLETED,
        UserRole.ADMIN
      );
      expect(transition.valid).toBe(false);
      expect(transition.reason).toContain('Direct transition from DRAFT to COMPLETED is forbidden');
    });

    it('requires a mandatory reason when marking a task BLOCKED', () => {
      const noReason = isValidTaskTransition(
        TaskStatus.IN_PROGRESS,
        TaskStatus.BLOCKED,
        UserRole.FIELD_WORKER
      );
      expect(noReason.valid).toBe(false);
      expect(noReason.reason).toContain('requires a non-empty blocked_reason');

      const withReason = isValidTaskTransition(
        TaskStatus.IN_PROGRESS,
        TaskStatus.BLOCKED,
        UserRole.FIELD_WORKER,
        { blockedReason: 'Site power line severed' }
      );
      expect(withReason.valid).toBe(true);
    });
  });

  describe('API Authorization Enforcement', () => {
    it('returns 403 when Field Worker attempts to create a task via TaskService', async () => {
      const customFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          error: {
            code: ErrorCode.TASK_ACCESS_DENIED,
            message: 'Field workers do not possess task:create permission.',
            request_id: 'req_rbac_001',
          },
        }),
      });

      const client = new FieldOpsApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: customFetch as unknown as typeof fetch,
        maxRetries: 0,
      });
      const taskService = new TaskService(client);

      await expect(
        taskService.createTask({
          title: 'Unauthorized Task',
        })
      ).rejects.toThrowError(
        expect.objectContaining({
          status: 403,
          detail: expect.objectContaining({
            code: ErrorCode.TASK_ACCESS_DENIED,
          }),
        })
      );
    });
  });
});
