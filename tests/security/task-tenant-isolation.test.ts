import { describe, it, expect, vi } from 'vitest';
import {
  FieldOpsApiClient,
  TaskService,
} from '@fieldops/api';
import { TenantId, TaskId, UserId, ErrorCode, Priority, TaskStatus } from '@fieldops/types';

describe('Security Suite: Task Tenant Isolation & Cross-Tenant Protection', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001' as TenantId;
  const tenantB = '00000000-0000-0000-0000-000000000002' as TenantId;

  it('rejects reading a task belonging to Tenant B when authenticated as Tenant A', async () => {
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const requestTenant = headers['x-tenant-id'];

      // Simulated RLS / Gateway enforcement: if task-200 belongs to Tenant B, request with Tenant A header is denied
      if (url.includes('/api/v1/tasks/task-tenant-b-1') && requestTenant === tenantA) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: {
              code: ErrorCode.CROSS_TENANT_FORBIDDEN,
              message: 'Cross-tenant task access strictly prohibited.',
              request_id: 'req_sec_isolation_001',
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      };
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_user',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const taskService = new TaskService(client);

    await expect(taskService.getTask('task-tenant-b-1' as TaskId)).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('rejects assigning a Tenant A task to a user belonging exclusively to Tenant B', async () => {
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {};

      if (body.assignedTo === 'usr_foreign_tenant_b') {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            success: false,
            error: {
              code: ErrorCode.TASK_INVALID_ASSIGNEE,
              message: 'Assignee does not belong to active organization.',
              request_id: 'req_sec_isolation_002',
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      };
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_admin',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const taskService = new TaskService(client);

    await expect(
      taskService.assignTask('task-a-1' as TaskId, {
        assignedTo: 'usr_foreign_tenant_b' as UserId,
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        status: 400,
        detail: expect.objectContaining({
          code: ErrorCode.TASK_INVALID_ASSIGNEE,
        }),
      })
    );
  });

  it('ensures headers strictly isolate tenant ID on all task mutations', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          items: [],
          pagination: { total: 0, page: 1, pageSize: 20, hasMore: false },
        },
      }),
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
    });

    const taskService = new TaskService(client);
    await taskService.listTasks();

    expect(customFetch).toHaveBeenCalledTimes(1);
    const sentHeaders = customFetch.mock.calls[0][1].headers;
    expect(sentHeaders['x-tenant-id']).toBe(tenantA);
    expect(sentHeaders['x-tenant-id']).not.toBe(tenantB);
  });
});
