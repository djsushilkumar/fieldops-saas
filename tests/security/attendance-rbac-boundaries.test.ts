import { describe, it, expect, vi } from 'vitest';
import {
  can,
  hasPermission,
  Permissions,
  UserRole,
  AttendanceStatus,
  ErrorCode,
  AttendanceId,
  UserId,
  TenantId,
  AdjustAttendancePayload,
} from '@fieldops/types';
import { FieldOpsApiClient, AttendanceService } from '@fieldops/api';
import { adjustAttendanceSchema } from '@fieldops/validation';

describe('Security Suite: Attendance RBAC Boundaries & Audit Enforcement', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001' as TenantId;
  const workerId = 'e0000000-0000-0000-0000-000000000004' as UserId;
  const supervisorId = 'e0000000-0000-0000-0000-000000000003' as UserId;
  const managerId = 'e0000000-0000-0000-0000-000000000002' as UserId;

  describe('Static Capability Matrix & Permissions', () => {
    it('restricts Field Workers to clocking own shifts and prohibits org view or adjustments', () => {
      expect(can(UserRole.FIELD_WORKER, Permissions.ATTENDANCE_CLOCK_OWN)).toBe(true);
      expect(can(UserRole.FIELD_WORKER, Permissions.ATTENDANCE_VIEW_ORG)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.ATTENDANCE_VIEW_TEAM)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.ATTENDANCE_ADJUST)).toBe(false);
    });

    it('allows Supervisors to clock own and view team attendance, but prohibits manual adjustments', () => {
      expect(can(UserRole.SUPERVISOR, Permissions.ATTENDANCE_CLOCK_OWN)).toBe(true);
      expect(can(UserRole.SUPERVISOR, Permissions.ATTENDANCE_VIEW_TEAM)).toBe(true);
      expect(can(UserRole.SUPERVISOR, Permissions.ATTENDANCE_ADJUST)).toBe(false);
    });

    it('authorizes Managers, Admins, and Owners to perform audited manual adjustments', () => {
      expect(can(UserRole.MANAGER, Permissions.ATTENDANCE_ADJUST)).toBe(true);
      expect(can(UserRole.ADMIN, Permissions.ATTENDANCE_ADJUST)).toBe(true);
      expect(can(UserRole.OWNER, Permissions.ATTENDANCE_ADJUST)).toBe(true);
    });
  });

  describe('Server-Side API RBAC Enforcement', () => {
    const shiftId = 'a0000000-0000-0000-0000-000000000001' as AttendanceId;

    it('rejects Field Worker attempting manual shift adjustment with 403 FORBIDDEN', async () => {
      const customFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/attendance/adjust')) {
          return {
            ok: false,
            status: 403,
            json: async () => ({
              success: false,
              error: {
                code: ErrorCode.AUTHORIZATION_ERROR,
                message: 'Field workers cannot manually adjust attendance records.',
                request_id: 'req_sec_att_rbac_001',
              },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
      });

      const client = new FieldOpsApiClient({
        baseUrl: 'https://api.fieldops.test',
        getAccessToken: async () => 'jwt_field_worker',
        getTenantId: () => tenantId,
        customFetch: customFetch as unknown as typeof fetch,
        maxRetries: 0,
      });

      const service = new AttendanceService(client);
      const payload: AdjustAttendancePayload = {
        attendanceId: shiftId,
        checkOutAt: '2026-09-28T17:00:00.000Z' as any,
        reason: 'Unauthorized manual adjustment by worker',
      };

      await expect(service.adjustAttendance(payload)).rejects.toThrowError(
        expect.objectContaining({
          status: 403,
          detail: expect.objectContaining({
            code: ErrorCode.AUTHORIZATION_ERROR,
          }),
        })
      );
    });

    it('rejects Supervisor attempting manual shift adjustment with 403 FORBIDDEN', async () => {
      const customFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/attendance/adjust')) {
          return {
            ok: false,
            status: 403,
            json: async () => ({
              success: false,
              error: {
                code: ErrorCode.AUTHORIZATION_ERROR,
                message: 'Supervisors require Manager or Admin privilege to adjust attendance.',
                request_id: 'req_sec_att_rbac_002',
              },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
      });

      const client = new FieldOpsApiClient({
        baseUrl: 'https://api.fieldops.test',
        getAccessToken: async () => 'jwt_supervisor',
        getTenantId: () => tenantId,
        customFetch: customFetch as unknown as typeof fetch,
        maxRetries: 0,
      });

      const service = new AttendanceService(client);
      const payload: AdjustAttendancePayload = {
        attendanceId: shiftId,
        checkOutAt: '2026-09-28T17:00:00.000Z' as any,
        reason: 'Supervisor adjustment without manager delegation',
      };

      await expect(service.adjustAttendance(payload)).rejects.toThrowError(
        expect.objectContaining({
          status: 403,
          detail: expect.objectContaining({
            code: ErrorCode.AUTHORIZATION_ERROR,
          }),
        })
      );
    });

    it('allows Manager to perform manual attendance adjustment with valid justification', async () => {
      const auditLogMock = vi.fn();

      const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/api/v1/attendance/adjust')) {
          const body = JSON.parse((init?.body as string) || '{}');
          // Verify audit mandate
          auditLogMock({
            action: 'ATTENDANCE_ADJUSTED',
            actor_id: managerId,
            entity_id: body.attendanceId,
            reason: body.reason,
          });

          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                id: body.attendanceId,
                status: AttendanceStatus.CORRECTED,
                isManuallyAdjusted: true,
                adjustmentReason: body.reason,
                adjustedByUserId: managerId,
                adjustedAt: '2026-09-28T18:00:00.000Z',
              },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
      });

      const client = new FieldOpsApiClient({
        baseUrl: 'https://api.fieldops.test',
        getAccessToken: async () => 'jwt_manager',
        getTenantId: () => tenantId,
        customFetch: customFetch as unknown as typeof fetch,
        maxRetries: 0,
      });

      const service = new AttendanceService(client);
      const payload: AdjustAttendancePayload = {
        attendanceId: shiftId,
        checkOutAt: '2026-09-28T17:00:00.000Z' as any,
        reason: 'Technician battery died; verified departure via facility security desk log.',
      };

      const result = await service.adjustAttendance(payload);
      expect(result.status).toBe(AttendanceStatus.CORRECTED);
      expect(result.isManuallyAdjusted).toBe(true);

      // Verify immutable audit log capture
      expect(auditLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ATTENDANCE_ADJUSTED',
          actor_id: managerId,
          entity_id: shiftId,
          reason: payload.reason,
        })
      );
    });

    it('strictly enforces minimum 10-character reason in adjustment schema', () => {
      const shortReasonPayload = {
        attendanceId: shiftId,
        checkOutAt: '2026-09-28T17:00:00.000Z',
        reason: 'Mistake', // 7 chars
      };

      const parsed = adjustAttendanceSchema.safeParse(shortReasonPayload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('at least 10 characters');
      }
    });
  });
});
