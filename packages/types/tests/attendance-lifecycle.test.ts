import { describe, it, expect } from 'vitest';
import {
  AttendanceStatus,
  WorkerActivityType,
  isValidAttendanceTransition,
  calculateShiftDurationSeconds,
  formatShiftDuration,
} from '../src/index';

describe('Attendance Lifecycle & Domain Rules', () => {
  describe('isValidAttendanceTransition', () => {
    it('allows self-transition (idempotent)', () => {
      expect(isValidAttendanceTransition(AttendanceStatus.CLOCKED_IN, AttendanceStatus.CLOCKED_IN).valid).toBe(true);
      expect(isValidAttendanceTransition(AttendanceStatus.CLOCKED_OUT, AttendanceStatus.CLOCKED_OUT).valid).toBe(true);
    });

    it('allows active shift (CLOCKED_IN/CHECKED_IN) to transition to CLOCKED_OUT or ON_BREAK', () => {
      expect(isValidAttendanceTransition(AttendanceStatus.CLOCKED_IN, AttendanceStatus.CLOCKED_OUT).valid).toBe(true);
      expect(isValidAttendanceTransition(AttendanceStatus.CLOCKED_IN, AttendanceStatus.CHECKED_OUT).valid).toBe(true);
      expect(isValidAttendanceTransition(AttendanceStatus.CLOCKED_IN, AttendanceStatus.ON_BREAK).valid).toBe(true);
      expect(isValidAttendanceTransition(AttendanceStatus.CHECKED_IN, AttendanceStatus.CHECKED_OUT).valid).toBe(true);
    });

    it('allows break to resume to CLOCKED_IN or transition to CLOCKED_OUT', () => {
      expect(isValidAttendanceTransition(AttendanceStatus.ON_BREAK, AttendanceStatus.CLOCKED_IN).valid).toBe(true);
      expect(isValidAttendanceTransition(AttendanceStatus.ON_BREAK, AttendanceStatus.CLOCKED_OUT).valid).toBe(true);
    });

    it('allows any state to transition to CORRECTED via supervisor override', () => {
      expect(isValidAttendanceTransition(AttendanceStatus.CLOCKED_IN, AttendanceStatus.CORRECTED).valid).toBe(true);
      expect(isValidAttendanceTransition(AttendanceStatus.CLOCKED_OUT, AttendanceStatus.CORRECTED).valid).toBe(true);
      expect(isValidAttendanceTransition(AttendanceStatus.CHECKED_OUT, AttendanceStatus.CORRECTED).valid).toBe(true);
      expect(isValidAttendanceTransition(AttendanceStatus.ON_BREAK, AttendanceStatus.CORRECTED).valid).toBe(true);
    });

    it('prohibits closed shifts from direct reopening without formal correction', () => {
      const res = isValidAttendanceTransition(AttendanceStatus.CLOCKED_OUT, AttendanceStatus.CLOCKED_IN);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('cannot be reopened directly');
    });
  });

  describe('calculateShiftDurationSeconds', () => {
    it('calculates duration accurately between check-in and check-out', () => {
      const start = '2026-09-28T08:00:00.000Z';
      const end = '2026-09-28T16:30:00.000Z';
      const duration = calculateShiftDurationSeconds(start, end);
      expect(duration).toBe(8.5 * 3600); // 30600 seconds
    });

    it('calculates live duration against now if not checked out', () => {
      const start = '2026-09-28T08:00:00.000Z';
      const now = new Date('2026-09-28T10:00:00.000Z');
      const duration = calculateShiftDurationSeconds(start, null, now);
      expect(duration).toBe(2 * 3600);
    });

    it('handles negative or invalid interval gracefully by returning 0', () => {
      const start = '2026-09-28T10:00:00.000Z';
      const end = '2026-09-28T08:00:00.000Z';
      expect(calculateShiftDurationSeconds(start, end)).toBe(0);
    });
  });

  describe('formatShiftDuration', () => {
    it('formats minutes only when under 1 hour', () => {
      expect(formatShiftDuration(1800)).toBe('30m');
      expect(formatShiftDuration(45)).toBe('0m');
    });

    it('formats hours and minutes when 1 hour or more', () => {
      expect(formatShiftDuration(3600)).toBe('1h 0m');
      expect(formatShiftDuration(5400)).toBe('1h 30m');
      expect(formatShiftDuration(30600)).toBe('8h 30m');
    });

    it('handles null, undefined, and negative values', () => {
      expect(formatShiftDuration(null)).toBe('0m');
      expect(formatShiftDuration(undefined)).toBe('0m');
      expect(formatShiftDuration(-100)).toBe('0m');
    });
  });

  describe('WorkerActivityType Enums', () => {
    it('defines mandatory activity types for workforce ledger', () => {
      expect(WorkerActivityType.ATTENDANCE_CHECKIN).toBe('ATTENDANCE_CHECKIN');
      expect(WorkerActivityType.ATTENDANCE_CHECKOUT).toBe('ATTENDANCE_CHECKOUT');
      expect(WorkerActivityType.ATTENDANCE_CORRECTED).toBe('ATTENDANCE_CORRECTED');
      expect(WorkerActivityType.TASK_ACCEPTED).toBe('TASK_ACCEPTED');
      expect(WorkerActivityType.VISIT_CHECKIN).toBe('VISIT_CHECKIN');
    });
  });
});
