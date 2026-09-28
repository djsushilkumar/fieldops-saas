import { describe, it, expect } from 'vitest';
import {
  TaskStatus,
  UserRole,
  isValidTaskTransition,
  isTaskOverdue,
  IsoDateTime,
} from '../src/index';

describe('Task State Machine & Lifecycle Transitions', () => {
  it('allows standard forward progression: DRAFT -> ASSIGNED -> ACCEPTED -> IN_PROGRESS -> COMPLETED', () => {
    // 1. DRAFT -> ASSIGNED
    expect(
      isValidTaskTransition(TaskStatus.DRAFT, TaskStatus.ASSIGNED, UserRole.MANAGER, {
        hasAssignee: true,
      }).valid
    ).toBe(true);

    // 2. ASSIGNED -> ACCEPTED
    expect(
      isValidTaskTransition(TaskStatus.ASSIGNED, TaskStatus.ACCEPTED, UserRole.FIELD_WORKER).valid
    ).toBe(true);

    // 3. ACCEPTED -> IN_PROGRESS
    expect(
      isValidTaskTransition(TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS, UserRole.FIELD_WORKER).valid
    ).toBe(true);

    // 4. IN_PROGRESS -> COMPLETED (with all required checklists done)
    expect(
      isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, UserRole.FIELD_WORKER, {
        incompleteRequiredChecklists: 0,
      }).valid
    ).toBe(true);
  });

  it('allows direct start from ASSIGNED to IN_PROGRESS', () => {
    expect(
      isValidTaskTransition(TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, UserRole.FIELD_WORKER).valid
    ).toBe(true);
  });

  it('rejects jumping directly from DRAFT to COMPLETED', () => {
    const res = isValidTaskTransition(TaskStatus.DRAFT, TaskStatus.COMPLETED, UserRole.MANAGER);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Direct transition from DRAFT to COMPLETED is forbidden');
  });

  it('rejects transitioning to BLOCKED without a non-empty blocked reason', () => {
    const resNoReason = isValidTaskTransition(
      TaskStatus.IN_PROGRESS,
      TaskStatus.BLOCKED,
      UserRole.FIELD_WORKER
    );
    expect(resNoReason.valid).toBe(false);
    expect(resNoReason.reason).toContain('requires a non-empty blocked_reason');

    const resEmpty = isValidTaskTransition(
      TaskStatus.IN_PROGRESS,
      TaskStatus.BLOCKED,
      UserRole.FIELD_WORKER,
      { blockedReason: '   ' }
    );
    expect(resEmpty.valid).toBe(false);

    const resValid = isValidTaskTransition(
      TaskStatus.IN_PROGRESS,
      TaskStatus.BLOCKED,
      UserRole.FIELD_WORKER,
      { blockedReason: 'Part awaiting delivery from central warehouse' }
    );
    expect(resValid.valid).toBe(true);
  });

  it('rejects completing task when required checklist items are unfinished', () => {
    const res = isValidTaskTransition(
      TaskStatus.IN_PROGRESS,
      TaskStatus.COMPLETED,
      UserRole.FIELD_WORKER,
      { incompleteRequiredChecklists: 2 }
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Cannot complete task with 2 unfinished required checklist items');
  });

  it('allows Supervisor to unblock and resume a BLOCKED task', () => {
    expect(
      isValidTaskTransition(TaskStatus.BLOCKED, TaskStatus.IN_PROGRESS, UserRole.SUPERVISOR).valid
    ).toBe(true);
  });

  it('allows reopening COMPLETED tasks to IN_PROGRESS by Supervisor or Manager', () => {
    expect(
      isValidTaskTransition(TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS, UserRole.SUPERVISOR, {
        reopenReason: 'Refrigerant pressure below acceptable tolerance',
      }).valid
    ).toBe(true);

    expect(
      isValidTaskTransition(TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS, UserRole.MANAGER).valid
    ).toBe(true);
  });

  it('prohibits Field Worker from reopening a COMPLETED task', () => {
    const res = isValidTaskTransition(
      TaskStatus.COMPLETED,
      TaskStatus.IN_PROGRESS,
      UserRole.FIELD_WORKER
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Field Workers cannot reopen completed tasks');
  });

  it('prohibits Field Worker from canceling a task', () => {
    const res = isValidTaskTransition(
      TaskStatus.ASSIGNED,
      TaskStatus.CANCELED,
      UserRole.FIELD_WORKER
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Field Workers cannot cancel tasks');
  });

  it('treats CANCELED as a terminal state with no subsequent transitions', () => {
    expect(
      isValidTaskTransition(TaskStatus.CANCELED, TaskStatus.IN_PROGRESS, UserRole.OWNER).valid
    ).toBe(false);
    expect(
      isValidTaskTransition(TaskStatus.CANCELED, TaskStatus.DRAFT, UserRole.OWNER).valid
    ).toBe(false);
  });
});

describe('Overdue Task Calculation', () => {
  it('correctly identifies overdue tasks when due date has passed', () => {
    const now = new Date('2026-09-28T12:00:00.000Z');
    const pastDue = {
      status: TaskStatus.IN_PROGRESS,
      dueAt: '2026-09-28T10:00:00.000Z' as IsoDateTime,
    };
    expect(isTaskOverdue(pastDue, now)).toBe(true);
  });

  it('does not mark completed or canceled tasks as overdue', () => {
    const now = new Date('2026-09-28T12:00:00.000Z');
    const completedPastDue = {
      status: TaskStatus.COMPLETED,
      dueAt: '2026-09-28T10:00:00.000Z' as IsoDateTime,
    };
    const canceledPastDue = {
      status: TaskStatus.CANCELED,
      dueAt: '2026-09-28T10:00:00.000Z' as IsoDateTime,
    };
    expect(isTaskOverdue(completedPastDue, now)).toBe(false);
    expect(isTaskOverdue(canceledPastDue, now)).toBe(false);
  });

  it('does not mark future due dates as overdue', () => {
    const now = new Date('2026-09-28T12:00:00.000Z');
    const futureTask = {
      status: TaskStatus.IN_PROGRESS,
      dueAt: '2026-09-28T18:00:00.000Z' as IsoDateTime,
    };
    expect(isTaskOverdue(futureTask, now)).toBe(false);
  });

  it('handles tasks without due date', () => {
    expect(isTaskOverdue({ status: TaskStatus.IN_PROGRESS, dueAt: null })).toBe(false);
  });
});
