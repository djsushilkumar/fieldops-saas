import { describe, it, expect } from 'vitest';
import {
  TaskStatus,
  Priority,
  UserRole,
  isValidTaskTransition,
  isTaskOverdue,
  can,
  Permissions,
} from '@fieldops/types';

describe('Web Task Management Unit Tests', () => {
  describe('Lifecycle State Machine in Web Client', () => {
    it('prevents Field Worker from canceling tasks', () => {
      const result = isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.CANCELED, UserRole.FIELD_WORKER);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Field Workers cannot cancel tasks');
    });

    it('allows Supervisor and Admin to cancel tasks', () => {
      const resSup = isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.CANCELED, UserRole.SUPERVISOR);
      expect(resSup.valid).toBe(true);

      const resAdmin = isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.CANCELED, UserRole.ADMIN);
      expect(resAdmin.valid).toBe(true);
    });

    it('blocks completion when required checklist items are incomplete', () => {
      const result = isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, UserRole.FIELD_WORKER, {
        incompleteRequiredChecklists: 2,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('unfinished required checklist items');
    });

    it('allows completion when all required checklist items are completed', () => {
      const result = isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, UserRole.FIELD_WORKER, {
        incompleteRequiredChecklists: 0,
      });
      expect(result.valid).toBe(true);
    });

    it('requires blockedReason when transitioning to BLOCKED', () => {
      const withoutReason = isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, UserRole.FIELD_WORKER);
      expect(withoutReason.valid).toBe(false);
      expect(withoutReason.reason).toContain('requires a non-empty blocked_reason');

      const withReason = isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, UserRole.FIELD_WORKER, {
        blockedReason: 'Main circuit breaker missing replacement fuses.',
      });
      expect(withReason.valid).toBe(true);
    });

    it('restricts task reopening to Supervisor, Manager, Admin, Owner', () => {
      const workerReopen = isValidTaskTransition(TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS, UserRole.FIELD_WORKER);
      expect(workerReopen.valid).toBe(false);
      expect(workerReopen.reason).toContain('Field Workers cannot reopen completed tasks');

      const supervisorReopen = isValidTaskTransition(TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS, UserRole.SUPERVISOR);
      expect(supervisorReopen.valid).toBe(true);
    });
  });

  describe('Overdue and Authority Evaluation', () => {
    it('correctly calculates overdue status based on UTC timestamps', () => {
      const now = new Date('2026-09-28T12:00:00.000Z');
      const pastTask = {
        status: TaskStatus.IN_PROGRESS,
        dueAt: '2026-09-28T10:00:00.000Z',
      };
      const futureTask = {
        status: TaskStatus.IN_PROGRESS,
        dueAt: '2026-09-28T14:00:00.000Z',
      };
      const completedPastTask = {
        status: TaskStatus.COMPLETED,
        dueAt: '2026-09-28T10:00:00.000Z',
      };

      expect(isTaskOverdue(pastTask, now)).toBe(true);
      expect(isTaskOverdue(futureTask, now)).toBe(false);
      expect(isTaskOverdue(completedPastTask, now)).toBe(false);
    });

    it('evaluates task authority permissions across roles', () => {
      expect(can(UserRole.FIELD_WORKER, Permissions.TASK_CREATE)).toBe(false);
      expect(can(UserRole.SUPERVISOR, Permissions.TASK_CREATE)).toBe(true);
      expect(can(UserRole.ADMIN, Permissions.TASK_CREATE)).toBe(true);

      expect(can(UserRole.FIELD_WORKER, Permissions.TASK_VIEW_OWN)).toBe(true);
      expect(can(UserRole.FIELD_WORKER, Permissions.TASK_VIEW_ALL)).toBe(false);
      expect(can(UserRole.SUPERVISOR, Permissions.TASK_VIEW_TEAM)).toBe(true);
      expect(can(UserRole.MANAGER, Permissions.TASK_VIEW_ALL)).toBe(true);
    });
  });
});
