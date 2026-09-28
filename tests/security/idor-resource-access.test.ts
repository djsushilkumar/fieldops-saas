import { describe, it, expect, vi } from 'vitest';
import {
  FieldOpsApiClient,
  TaskService,
  VisitService,
  LocationService,
  AttendanceService,
  BillingService,
  ReportService,
} from '@fieldops/api';
import {
  TenantId,
  TaskId,
  VisitId,
  LocationId,
  AttendanceId,
  UserId,
  ErrorCode,
} from '@fieldops/types';

describe('Security Suite: Insecure Direct Object References (IDOR) Defense', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001' as TenantId;
  const foreignTenantB = '00000000-0000-0000-0000-000000000002' as TenantId;

  // Foreign entity IDs belonging to Tenant B
  const foreignTaskId = 't0000000-0000-0000-0000-000000000099' as TaskId;
  const foreignVisitId = 'v0000000-0000-0000-0000-000000000099' as VisitId;
  const foreignLocationId = 'l0000000-0000-0000-0000-000000000099' as LocationId;
  const foreignAttendanceId = 'a0000000-0000-0000-0000-000000000099' as AttendanceId;
  const foreignUserId = 'u0000000-0000-0000-0000-000000000099' as UserId;

  const createMockFetch = () => {
    return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const requestTenant = headers['x-tenant-id'];

      // If accessing a foreign resource while authenticated as Tenant A, simulate server authorization check
      if (
        (url.includes(foreignTaskId) ||
          url.includes(foreignVisitId) ||
          url.includes(foreignLocationId) ||
          url.includes(foreignAttendanceId) ||
          url.includes(`userId=${foreignUserId}`)) &&
        requestTenant === tenantA
      ) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: {
              code: ErrorCode.CROSS_TENANT_FORBIDDEN,
              message: 'Access to foreign tenant resource is strictly denied.',
              request_id: 'req_sec_idor_001',
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
  };

  it('rejects IDOR attempt to read foreign Task details', async () => {
    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_user',
      getTenantId: () => tenantA,
      customFetch: createMockFetch() as unknown as typeof fetch,
      maxRetries: 0,
    });
    const taskService = new TaskService(client);

    await expect(taskService.getTask(foreignTaskId)).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('rejects IDOR attempt to read foreign Visit details', async () => {
    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_user',
      getTenantId: () => tenantA,
      customFetch: createMockFetch() as unknown as typeof fetch,
      maxRetries: 0,
    });
    const visitService = new VisitService(client);

    await expect(visitService.getVisit(foreignVisitId)).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('rejects IDOR attempt to list proofs for foreign Visit', async () => {
    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_user',
      getTenantId: () => tenantA,
      customFetch: createMockFetch() as unknown as typeof fetch,
      maxRetries: 0,
    });
    const visitService = new VisitService(client);

    await expect(visitService.listProofs(foreignVisitId)).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('rejects IDOR attempt to read foreign Customer Location', async () => {
    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_user',
      getTenantId: () => tenantA,
      customFetch: createMockFetch() as unknown as typeof fetch,
      maxRetries: 0,
    });
    const locationService = new LocationService(client);

    await expect(locationService.getLocation(foreignLocationId)).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('rejects IDOR attempt to read foreign Attendance Record', async () => {
    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_user',
      getTenantId: () => tenantA,
      customFetch: createMockFetch() as unknown as typeof fetch,
      maxRetries: 0,
    });
    const attendanceService = new AttendanceService(client);

    await expect(attendanceService.getAttendance(foreignAttendanceId)).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('rejects IDOR attempt to query activities of a foreign tenant user', async () => {
    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_user',
      getTenantId: () => tenantA,
      customFetch: createMockFetch() as unknown as typeof fetch,
      maxRetries: 0,
    });
    const attendanceService = new AttendanceService(client);

    await expect(attendanceService.listWorkerActivities(foreignUserId)).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });
});
