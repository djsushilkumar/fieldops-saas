import { describe, it, expect } from 'vitest';
import {
  attendanceClockInSchema,
  attendanceClockOutSchema,
  adjustAttendanceSchema,
  attendanceFilterSchema,
} from '../src/index';

describe('Attendance Validation Schemas', () => {
  const validUUID = 'a0000000-0000-0000-0000-000000000001';

  describe('attendanceClockInSchema', () => {
    it('accepts valid clock-in payload with coordinates and notes', () => {
      const valid = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracyMeters: 15.5,
        capturedAt: '2026-09-28T08:00:00.000Z',
        notes: 'Shift started at depot.',
      };
      const result = attendanceClockInSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('accepts minimal clock-in without optional coordinates', () => {
      const result = attendanceClockInSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects out-of-range coordinates', () => {
      const invalidLat = { latitude: 95.0, longitude: -122.4 };
      expect(attendanceClockInSchema.safeParse(invalidLat).success).toBe(false);

      const invalidLng = { latitude: 37.0, longitude: 190.0 };
      expect(attendanceClockInSchema.safeParse(invalidLng).success).toBe(false);
    });

    it('rejects negative GPS accuracy', () => {
      const invalidAccuracy = { accuracyMeters: -5.0 };
      expect(attendanceClockInSchema.safeParse(invalidAccuracy).success).toBe(false);
    });
  });

  describe('attendanceClockOutSchema', () => {
    it('accepts valid clock-out payload with attendance ID', () => {
      const valid = {
        attendanceId: validUUID,
        latitude: 37.7749,
        longitude: -122.4194,
        accuracyMeters: 10.0,
      };
      const result = attendanceClockOutSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects clock-out without attendanceId', () => {
      const result = attendanceClockOutSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('adjustAttendanceSchema', () => {
    it('accepts valid manual adjustment with reason >= 10 chars and valid timestamps', () => {
      const valid = {
        attendanceId: validUUID,
        checkInAt: '2026-09-28T08:00:00.000Z',
        checkOutAt: '2026-09-28T16:30:00.000Z',
        reason: 'Technician forgot to clock out before device battery died.',
      };
      const result = adjustAttendanceSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects adjustment reason with less than 10 characters', () => {
      const invalid = {
        attendanceId: validUUID,
        checkInAt: '2026-09-28T08:00:00.000Z',
        checkOutAt: '2026-09-28T16:30:00.000Z',
        reason: 'Typo fix',
      };
      const result = adjustAttendanceSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 10 characters');
      }
    });

    it('rejects adjustment where checkOutAt is earlier than checkInAt', () => {
      const invalid = {
        attendanceId: validUUID,
        checkInAt: '2026-09-28T16:30:00.000Z',
        checkOutAt: '2026-09-28T08:00:00.000Z',
        reason: 'Adjusting clock out earlier than clock in time',
      };
      const result = adjustAttendanceSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('earlier than check-in');
      }
    });
  });

  describe('attendanceFilterSchema', () => {
    it('accepts valid date format YYYY-MM-DD', () => {
      const valid = {
        date: '2026-09-28',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        isAdjusted: 'true',
      };
      const result = attendanceFilterSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAdjusted).toBe(true);
      }
    });

    it('rejects invalid date format', () => {
      expect(attendanceFilterSchema.safeParse({ date: '28/09/2026' }).success).toBe(false);
      expect(attendanceFilterSchema.safeParse({ date: 'invalid-date' }).success).toBe(false);
    });
  });
});
