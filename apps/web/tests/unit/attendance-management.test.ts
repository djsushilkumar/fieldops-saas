import { describe, it, expect } from 'vitest';
import {
  AttendanceStatus,
  UserRole,
  can,
  Permissions,
  isValidAttendanceTransition,
  calculateShiftDurationSeconds,
  formatShiftDuration,
  AttendanceId,
} from '@fieldops/types';
import { adjustAttendanceSchema, attendanceFilterSchema } from '@fieldops/validation';

describe('Web Attendance Management Unit Tests', () => {
  describe('RBAC Authorization for Attendance Operations', () => {
    it('allows Field Worker to clock their own attendance but not adjust attendance', () => {
      expect(can(UserRole.FIELD_WORKER, Permissions.ATTENDANCE_CLOCK_OWN)).toBe(true);
      expect(can(UserRole.FIELD_WORKER, Permissions.ATTENDANCE_ADJUST)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.ATTENDANCE_VIEW_ORG)).toBe(false);
    });

    it('allows Supervisor to view team attendance but not adjust attendance without manager role', () => {
      expect(can(UserRole.SUPERVISOR, Permissions.ATTENDANCE_VIEW_TEAM)).toBe(true);
      expect(can(UserRole.SUPERVISOR, Permissions.ATTENDANCE_ADJUST)).toBe(false);
    });

    it('allows Manager, Admin, and Owner to adjust attendance', () => {
      expect(can(UserRole.MANAGER, Permissions.ATTENDANCE_ADJUST)).toBe(true);
      expect(can(UserRole.ADMIN, Permissions.ATTENDANCE_ADJUST)).toBe(true);
      expect(can(UserRole.OWNER, Permissions.ATTENDANCE_ADJUST)).toBe(true);
    });

    it('allows Manager, Admin, and Owner to view org-wide attendance', () => {
      expect(can(UserRole.MANAGER, Permissions.ATTENDANCE_VIEW_ORG)).toBe(true);
      expect(can(UserRole.ADMIN, Permissions.ATTENDANCE_VIEW_ORG)).toBe(true);
      expect(can(UserRole.OWNER, Permissions.ATTENDANCE_VIEW_ORG)).toBe(true);
    });
  });

  describe('Attendance Adjustment Validation', () => {
    const validId = 'a0000000-0000-0000-0000-000000000001' as AttendanceId;

    it('validates successful adjustment with justification >= 10 chars', () => {
      const payload = {
        attendanceId: validId,
        checkInAt: '2026-09-28T08:00:00.000Z',
        checkOutAt: '2026-09-28T16:30:00.000Z',
        reason: 'Adjusting shift due to cell tower outage in district 4',
      };
      const parsed = adjustAttendanceSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });

    it('rejects adjustment when reason has less than 10 characters', () => {
      const payload = {
        attendanceId: validId,
        checkInAt: '2026-09-28T08:00:00.000Z',
        checkOutAt: '2026-09-28T16:30:00.000Z',
        reason: 'Short msg',
      };
      const parsed = adjustAttendanceSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('at least 10 characters');
      }
    });

    it('rejects adjustment when checkout is earlier than checkin', () => {
      const payload = {
        attendanceId: validId,
        checkInAt: '2026-09-28T16:30:00.000Z',
        checkOutAt: '2026-09-28T08:00:00.000Z',
        reason: 'Adjusting shift due to cell tower outage in district 4',
      };
      const parsed = adjustAttendanceSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('earlier than check-in');
      }
    });
  });

  describe('Attendance Duration & Formatting', () => {
    it('calculates duration in seconds accurately', () => {
      const start = '2026-09-28T08:00:00.000Z';
      const end = '2026-09-28T16:30:00.000Z';
      const duration = calculateShiftDurationSeconds(start, end);
      expect(duration).toBe(30600);
      expect(formatShiftDuration(duration)).toBe('8h 30m');
    });

    it('formats active or sub-hour shifts', () => {
      expect(formatShiftDuration(1800)).toBe('30m');
      expect(formatShiftDuration(0)).toBe('0m');
    });
  });

  describe('Attendance State Machine', () => {
    it('allows transition to CORRECTED from any status', () => {
      expect(isValidAttendanceTransition(AttendanceStatus.CLOCKED_IN, AttendanceStatus.CORRECTED).valid).toBe(true);
      expect(isValidAttendanceTransition(AttendanceStatus.CLOCKED_OUT, AttendanceStatus.CORRECTED).valid).toBe(true);
    });

    it('prohibits direct reopening of closed shifts', () => {
      const res = isValidAttendanceTransition(AttendanceStatus.CLOCKED_OUT, AttendanceStatus.CLOCKED_IN);
      expect(res.valid).toBe(false);
    });
  });
});
