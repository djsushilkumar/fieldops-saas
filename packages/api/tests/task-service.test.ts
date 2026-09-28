import { describe, it, expect, vi } from 'vitest';
import {
  FieldOpsApiClient,
  TaskService,
  TeamService,
} from '../src/index';
import {
  TaskId,
  TeamId,
  UserId,
  TenantId,
  UUID,
  TaskStatus,
  Priority,
  IsoDateTime,
  MutationId,
  SyncStatus,
} from '@fieldops/types';

describe('Phase 04 TaskService & TeamService', () => {
  const mockTask = {
    id: 'tsk_101' as TaskId,
    organizationId: 'ten_01' as TenantId,
    title: 'Repair Main Substation Breaker',
    description: 'De-energize circuit and replace 200A fuse.',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.HIGH,
    createdBy: 'usr_owner' as UserId,
    assignedTo: 'usr_worker' as UserId,
    assignedTeam: 'team_alpha' as TeamId,
    dueAt: '2026-10-05T18:00:00.000Z' as IsoDateTime,
    version: 2,
    createdAt: '2026-09-28T10:00:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-28T12:00:00.000Z' as IsoDateTime,
  };

  it('listTasks formats query parameters properly', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          items: [mockTask],
          pagination: {
            total: 1,
            page: 1,
            pageSize: 20,
            hasMore: false,
          },
        },
      }),
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      customFetch: customFetch as unknown as typeof fetch,
    });
    const taskService = new TaskService(client);

    const result = await taskService.listTasks(
      {
        status: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
        priority: Priority.HIGH,
        assignedTo: 'usr_worker' as UserId,
        isOverdue: true,
        search: 'Substation',
      },
      { page: 1, pageSize: 20 },
      { field: 'dueAt', order: 'asc' }
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('tsk_101');
    const calledUrl = new URL(customFetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe('/api/v1/tasks');
    expect(calledUrl.searchParams.get('status')).toBe('IN_PROGRESS,BLOCKED');
    expect(calledUrl.searchParams.get('priority')).toBe('HIGH');
    expect(calledUrl.searchParams.get('assignedTo')).toBe('usr_worker');
    expect(calledUrl.searchParams.get('isOverdue')).toBe('true');
    expect(calledUrl.searchParams.get('search')).toBe('Substation');
    expect(calledUrl.searchParams.get('sortField')).toBe('dueAt');
    expect(calledUrl.searchParams.get('sortOrder')).toBe('asc');
  });

  it('getTask retrieves a single task by ID', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockTask,
      }),
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      customFetch: customFetch as unknown as typeof fetch,
    });
    const taskService = new TaskService(client);

    const task = await taskService.getTask('tsk_101' as TaskId);
    expect(task.id).toBe('tsk_101');
    expect(task.title).toBe('Repair Main Substation Breaker');
  });

  it('createTask posts payload and returns created task', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: mockTask,
      }),
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      customFetch: customFetch as unknown as typeof fetch,
    });
    const taskService = new TaskService(client);

    const task = await taskService.createTask({
      title: 'Repair Main Substation Breaker',
      priority: Priority.HIGH,
    });

    expect(task.id).toBe('tsk_101');
    const reqBody = JSON.parse(customFetch.mock.calls[0][1].body);
    expect(reqBody.title).toBe('Repair Main Substation Breaker');
    expect(reqBody.priority).toBe(Priority.HIGH);
  });

  it('transitionStatus posts transition with reason and version', async () => {
    const transitionedTask = { ...mockTask, status: TaskStatus.BLOCKED, version: 3 };
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: transitionedTask,
      }),
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      customFetch: customFetch as unknown as typeof fetch,
    });
    const taskService = new TaskService(client);

    const updated = await taskService.transitionStatus('tsk_101' as TaskId, {
      status: TaskStatus.BLOCKED,
      blockedReason: 'Circuit energized by external vendor',
      expectedVersion: 2,
    });

    expect(updated.status).toBe(TaskStatus.BLOCKED);
    expect(updated.version).toBe(3);
    const reqBody = JSON.parse(customFetch.mock.calls[0][1].body);
    expect(reqBody.blockedReason).toBe('Circuit energized by external vendor');
  });

  it('handles checklist items add, toggle, and delete', async () => {
    const mockChecklistItem = {
      id: 'chk_1' as UUID,
      taskId: 'tsk_101' as TaskId,
      organizationId: 'ten_01' as TenantId,
      title: 'Verify voltage is zero with multimeter',
      position: 1,
      isRequired: true,
      isCompleted: false,
      createdAt: '2026-09-28T10:00:00.000Z' as IsoDateTime,
      updatedAt: '2026-09-28T10:00:00.000Z' as IsoDateTime,
    };

    const customFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: mockChecklistItem }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { ...mockChecklistItem, isCompleted: true } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { success: true } }),
      });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      customFetch: customFetch as unknown as typeof fetch,
    });
    const taskService = new TaskService(client);

    const added = await taskService.addChecklistItem('tsk_101' as TaskId, {
      title: 'Verify voltage is zero with multimeter',
      isRequired: true,
    });
    expect(added.title).toBe('Verify voltage is zero with multimeter');

    const toggled = await taskService.toggleChecklistItem('tsk_101' as TaskId, 'chk_1' as UUID, true);
    expect(toggled.isCompleted).toBe(true);

    const deleted = await taskService.deleteChecklistItem('tsk_101' as TaskId, 'chk_1' as UUID);
    expect(deleted.success).toBe(true);
  });

  it('syncOfflineMutations sends batch mutations and returns sync response', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          processed: 1,
          results: [
            {
              mutationId: 'mut_101' as MutationId,
              idempotencyKey: 'idem_key_123',
              status: 'APPLIED',
            },
          ],
        },
      }),
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      customFetch: customFetch as unknown as typeof fetch,
    });
    const taskService = new TaskService(client);

    const response = await taskService.syncOfflineMutations([
      {
        mutationId: 'mut_101' as MutationId,
        idempotencyKey: 'idem_key_123',
        tenantId: 'ten_01' as TenantId,
        userId: 'usr_worker' as UserId,
        entityType: 'task',
        entityId: 'tsk_101',
        action: 'transition_status',
        payload: { status: TaskStatus.IN_PROGRESS },
        clientTimestamp: '2026-09-28T12:00:00.000Z' as IsoDateTime,
        retryCount: 0,
        status: SyncStatus.PENDING,
      },
    ]);

    expect(response.processed).toBe(1);
    expect(response.results[0].status).toBe('APPLIED');
  });

  it('TeamService creates and manages team members', async () => {
    const mockTeam = {
      id: 'team_alpha' as TeamId,
      organizationId: 'ten_01' as TenantId,
      name: 'Alpha Electrical Crew',
      description: 'North quadrant emergency response',
      createdAt: '2026-09-28T08:00:00.000Z' as IsoDateTime,
      updatedAt: '2026-09-28T08:00:00.000Z' as IsoDateTime,
    };

    const customFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: mockTeam }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            id: 'tm_1' as UUID,
            teamId: 'team_alpha' as TeamId,
            userId: 'usr_worker' as UserId,
            organizationId: 'ten_01' as TenantId,
            createdAt: '2026-09-28T09:00:00.000Z' as IsoDateTime,
          },
        }),
      });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      customFetch: customFetch as unknown as typeof fetch,
    });
    const teamService = new TeamService(client);

    const created = await teamService.createTeam({
      name: 'Alpha Electrical Crew',
      description: 'North quadrant emergency response',
    });
    expect(created.name).toBe('Alpha Electrical Crew');

    const member = await teamService.addTeamMember('team_alpha' as TeamId, 'usr_worker' as UserId);
    expect(member.teamId).toBe('team_alpha');
    expect(member.userId).toBe('usr_worker');
  });
});
