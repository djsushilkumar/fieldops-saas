import { describe, it, expect, vi } from 'vitest';
import { FieldOpsApiClient, AttendanceService } from '@fieldops/api';
import {
  TenantId,
  AttendanceId,
  UserId,
  ErrorCode,
  AttendanceClockInPayload,
  AdjustAttendancePayload,
} from '@fieldops/types';

describe('Security Suite: Attendance & Workforce Tenant Isolation', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001' as TenantId;
  const tenantB = '00000000-0000-0000-0000-000000000002' as TenantId;

  it('rejects reading an attendance record belonging to Tenant B when authenticated as Tenant A', async () => {
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const requestTenant = headers['x-tenant-id'];

      // Simulated RLS enforcement: attendance-tenant-b-1 belongs to Tenant B
      if (url.includes('/api/v1/attendance/att-b-1') && requestTenant === tenantA) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: {
              code: ErrorCode.CROSS_TENANT_FORBIDDEN,
              message: 'Cross-tenant attendance access strictly prohibited.',
              request_id: 'req_sec_att_iso_001',
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

    const service = new AttendanceService(client);

    await expect(service.getAttendance('att-b-1' as AttendanceId)).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('rejects adjusting an attendance record belonging to Tenant B from a Tenant A manager', async () => {
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const requestTenant = headers['x-tenant-id'];

      if (url.includes('/api/v1/attendance/adjust') && requestTenant === tenantA) {
        const body = JSON.parse((init?.body as string) || '{}');
        if (body.attendanceId === 'att-b-1') {
          return {
            ok: false,
            status: 403,
            json: async () => ({
              success: false,
              error: {
                code: ErrorCode.CROSS_TENANT_FORBIDDEN,
                message: 'Cannot adjust attendance records belonging to an alien organization.',
                request_id: 'req_sec_att_iso_002',
              },
            }),
          };
        }
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      };
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_manager',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const service = new AttendanceService(client);
    const payload: AdjustAttendancePayload = {
      attendanceId: 'att-b-1' as AttendanceId,
      checkOutAt: '2026-09-28T17:00:00.000Z' as any,
      reason: 'Cross-tenant illegal adjustment attempt',
    };

    await expect(service.adjustAttendance(payload)).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('partitions worker activities ledger strictly by tenant ID', async () => {
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const requestTenant = headers['x-tenant-id'];

      if (url.includes('/api/v1/attendance/activities') && requestTenant === tenantA) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'act-a-1',
                organizationId: tenantA,
                userId: 'user-a-1',
                activityType: 'ATTENDANCE_CHECKIN',
                title: 'Clocked In',
                metadata: {},
                createdAt: '2026-09-28T08:00:00.000Z',
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      };
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_user',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const service = new AttendanceService(client);
    const activities = await service.listWorkerActivities('user-a-1' as UserId);

    expect(activities).toHaveLength(1);
    expect(activities[0].organizationId).toBe(tenantA);
  });
});
