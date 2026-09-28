import { describe, it, expect, vi } from 'vitest';
import {
  FieldOpsApiClient,
  TaskService,
} from '@fieldops/api';
import {
  TaskId,
  TenantId,
  UserId,
  MutationId,
  TaskStatus,
  SyncStatus,
  ErrorCode,
  IsoDateTime,
} from '@fieldops/types';

describe('Security Suite: Offline Sync Idempotency & Concurrency Integrity', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001' as TenantId;
  const userId = '00000000-0000-0000-0000-000000000011' as UserId;
  const taskId = '00000000-0000-0000-0000-000000000101' as TaskId;

  it('guarantees idempotency when duplicate mutations are submitted', async () => {
    const idempotencyKey = 'idem_worker1_task101_transition_1727500000';
    let callCount = 0;

    const customFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      callCount++;
      const body = JSON.parse(init?.body as string);
      const mutation = body.mutations[0];

      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              processed: 1,
              results: [
                {
                  mutationId: mutation.mutationId,
                  idempotencyKey: mutation.idempotencyKey,
                  status: 'APPLIED',
                },
              ],
            },
          }),
        };
      } else {
        // Second attempt with exact same idempotencyKey returns DEDUPLICATED
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              processed: 1,
              results: [
                {
                  mutationId: mutation.mutationId,
                  idempotencyKey: mutation.idempotencyKey,
                  status: 'DEDUPLICATED',
                },
              ],
            },
          }),
        };
      }
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_worker_token',
      getTenantId: () => tenantId,
      customFetch: customFetch as unknown as typeof fetch,
    });
    const taskService = new TaskService(client);

    const mutationPayload = {
      mutationId: 'mut_001' as MutationId,
      idempotencyKey,
      tenantId,
      userId,
      entityType: 'task',
      entityId: taskId,
      action: 'transition_status',
      payload: { status: TaskStatus.IN_PROGRESS },
      clientTimestamp: '2026-09-28T12:00:00.000Z' as IsoDateTime,
      retryCount: 0,
      status: SyncStatus.PENDING,
    };

    // First attempt: APPLIED
    const firstRes = await taskService.syncOfflineMutations([mutationPayload]);
    expect(firstRes.results[0].status).toBe('APPLIED');

    // Duplicate replay: DEDUPLICATED
    const secondRes = await taskService.syncOfflineMutations([mutationPayload]);
    expect(secondRes.results[0].status).toBe('DEDUPLICATED');
  });

  it('rejects stale optimistic concurrency updates with TASK_CONFLICT (HTTP 409)', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: {
          code: ErrorCode.TASK_CONFLICT,
          message: 'Task version mismatch: server version is 3, requested version is 1.',
          request_id: 'req_concurrency_409',
        },
      }),
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_worker_token',
      getTenantId: () => tenantId,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });
    const taskService = new TaskService(client);

    await expect(
      taskService.updateTask(taskId, {
        title: 'Conflicting title update',
        version: 1, // Stale version
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        status: 409,
        detail: expect.objectContaining({
          code: ErrorCode.TASK_CONFLICT,
        }),
      })
    );
  });
});
