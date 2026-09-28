import { describe, it, expect } from 'vitest';
import {
  calculateTaskReportSummary,
  calculateVisitReportSummary,
  calculateAttendanceReportSummary,
  calculateWorkforceReportSummary,
} from '../../src/lib/reporting-metrics';
import { buildCsv, escapeCsvCell, MAX_REPORT_EXPORT_ROWS } from '@fieldops/api';
import {
  TaskReportRow,
  TaskStatus,
  Priority,
  VisitReportRow,
  VisitStatus,
  LocationVerificationResult,
  AttendanceReportRow,
  AttendanceStatus,
  WorkforceReportRow,
  UserRole,
  can,
  Permissions,
  IsoDateTime,
} from '@fieldops/types';

describe('Report Generation & RFC 4180 CSV Unit Tests', () => {
  describe('RFC 4180 CSV Builder & Security Sanitization', () => {
    it('prepends UTF-8 Byte Order Mark (BOM) to CSV output', () => {
      const csv = buildCsv(['Header1', 'Header2'], [['Val1', 'Val2']]);
      expect(csv.charCodeAt(0)).toBe(0xfeff);
    });

    it('escapes cells containing commas, quotes, and newlines per RFC 4180', () => {
      const headers = ['Name', 'Notes'];
      const rows = [
        ['Acme, Inc.', 'Line 1\nLine 2'],
        ['John "The Boss" Doe', 'Normal note'],
      ];
      const csv = buildCsv(headers, rows);

      expect(csv).toContain('"Acme, Inc."');
      expect(csv).toContain('"Line 1\nLine 2"');
      expect(csv).toContain('"John ""The Boss"" Doe"');
    });

    it('sanitizes dangerous formula prefixes to prevent CSV injection attacks', () => {
      expect(escapeCsvCell('=cmd|calc!A0')).toBe("'=cmd|calc!A0");
      expect(escapeCsvCell('=cmd|"/C calc"!A0')).toBe('"\'=cmd|""/C calc""!A0"');
      expect(escapeCsvCell('+12345')).toBe("'+12345");
      expect(escapeCsvCell('-54321')).toBe("'-54321");
      expect(escapeCsvCell('@SUM(A1:B1)')).toBe("'@SUM(A1:B1)");
    });

    it('strictly enforces the 5,000 row export limit', () => {
      const headers = ['Col1'];
      const excessiveRows = new Array(MAX_REPORT_EXPORT_ROWS + 1).fill(['Data']);

      expect(() => buildCsv(headers, excessiveRows)).toThrow(
        /exceeds the maximum allowed limit of 5000/
      );
    });
  });

  describe('Task Report KPI Calculation', () => {
    it('calculates task completion rate excluding canceled tasks', () => {
      const rows: TaskReportRow[] = [
        {
          id: 't-1' as any,
          title: 'Task 1',
          priority: Priority.HIGH,
          status: TaskStatus.COMPLETED,
          checklistTotal: 2,
          checklistCompleted: 2,
          createdAt: '2026-09-01T00:00:00Z' as IsoDateTime,
        },
        {
          id: 't-2' as any,
          title: 'Task 2',
          priority: Priority.MEDIUM,
          status: TaskStatus.IN_PROGRESS,
          checklistTotal: 1,
          checklistCompleted: 0,
          createdAt: '2026-09-01T00:00:00Z' as IsoDateTime,
        },
        {
          id: 't-3' as any,
          title: 'Task 3',
          priority: Priority.LOW,
          status: TaskStatus.CANCELED, // Should not count towards active tasks
          checklistTotal: 0,
          checklistCompleted: 0,
          createdAt: '2026-09-01T00:00:00Z' as IsoDateTime,
        },
      ];

      const summary = calculateTaskReportSummary(rows);
      expect(summary.totalTasks).toBe(2);
      expect(summary.completedTasks).toBe(1);
      expect(summary.completionRatePercentage).toBe(50);
      expect(summary.inProgressTasks).toBe(1);
    });

    it('returns 0% without division by zero when rows are empty', () => {
      const summary = calculateTaskReportSummary([]);
      expect(summary.totalTasks).toBe(0);
      expect(summary.completedTasks).toBe(0);
      expect(summary.completionRatePercentage).toBe(0);
    });
  });

  describe('Visit Report KPI Calculation & Geofence Verification Rate', () => {
    it('calculates geofence verification rate and on-time check-in rate accurately', () => {
      const rows: VisitReportRow[] = [
        {
          id: 'v-1' as any,
          locationName: 'Site A',
          workerName: 'Marcus',
          scheduledStart: '2026-09-28T09:00:00Z' as IsoDateTime,
          checkedInAt: '2026-09-28T08:58:00Z' as IsoDateTime, // On time
          verificationResult: LocationVerificationResult.VALID,
          proofsCount: 2,
          status: VisitStatus.COMPLETED,
        },
        {
          id: 'v-2' as any,
          locationName: 'Site B',
          workerName: 'Elena',
          scheduledStart: '2026-09-28T10:00:00Z' as IsoDateTime,
          checkedInAt: '2026-09-28T10:15:00Z' as IsoDateTime, // Late (> 5 min tolerance)
          verificationResult: LocationVerificationResult.OUTSIDE_RADIUS,
          proofsCount: 1,
          status: VisitStatus.IN_PROGRESS,
        },
        {
          id: 'v-3' as any,
          locationName: 'Site C',
          workerName: 'Marcus',
          scheduledStart: '2026-09-28T14:00:00Z' as IsoDateTime,
          checkedInAt: null,
          verificationResult: null,
          proofsCount: 0,
          status: VisitStatus.MISSED,
        },
      ];

      const summary = calculateVisitReportSummary(rows);
      expect(summary.totalScheduled).toBe(3);
      expect(summary.completedVisits).toBe(1);
      expect(summary.missedVisits).toBe(1);
      // 2 checked-in visits: 1 on-time, 1 late => 50%
      expect(summary.onTimeCheckInRatePercentage).toBe(50);
      // 2 checked-in visits: 1 valid, 1 outside radius => 50%
      expect(summary.geofenceVerificationRatePercentage).toBe(50);
    });
  });

  describe('Attendance Report KPI Calculation', () => {
    it('calculates total duty hours and manual adjustment rate', () => {
      const rows: AttendanceReportRow[] = [
        {
          id: 'a-1' as any,
          date: '2026-09-28',
          workerName: 'Marcus',
          checkInAt: '2026-09-28T08:00:00Z' as IsoDateTime,
          checkOutAt: '2026-09-28T16:00:00Z' as IsoDateTime,
          durationSeconds: 28800, // 8 hours
          status: AttendanceStatus.CLOCKED_OUT,
          isManuallyAdjusted: false,
        },
        {
          id: 'a-2' as any,
          date: '2026-09-28',
          workerName: 'Elena',
          checkInAt: '2026-09-28T08:30:00Z' as IsoDateTime,
          checkOutAt: '2026-09-28T17:00:00Z' as IsoDateTime,
          durationSeconds: 30600, // 8.5 hours
          status: AttendanceStatus.CORRECTED,
          isManuallyAdjusted: true,
          adjustmentReason: 'Forgotten clock out',
        },
      ];

      const summary = calculateAttendanceReportSummary(rows);
      expect(summary.totalShifts).toBe(2);
      expect(summary.completedShifts).toBe(2);
      expect(summary.totalDutyHours).toBe(16.5);
      expect(summary.manualAdjustmentRatePercentage).toBe(50);
    });
  });

  describe('Workforce Activity Report KPI Calculation', () => {
    it('aggregates objective workforce execution metrics without competitive scores', () => {
      const rows: WorkforceReportRow[] = [
        {
          userId: 'u-1' as any,
          workerName: 'Marcus',
          workerEmail: 'marcus@fieldops.io',
          role: UserRole.FIELD_WORKER,
          assignedTasksCount: 10,
          completedTasksCount: 9,
          scheduledVisitsCount: 5,
          completedVisitsCount: 5,
          completedShiftsCount: 15,
          totalActivitiesCount: 45,
        },
        {
          userId: 'u-2' as any,
          workerName: 'Elena',
          workerEmail: 'elena@fieldops.io',
          role: UserRole.FIELD_WORKER,
          assignedTasksCount: 8,
          completedTasksCount: 8,
          scheduledVisitsCount: 4,
          completedVisitsCount: 3,
          completedShiftsCount: 14,
          totalActivitiesCount: 38,
        },
      ];

      const summary = calculateWorkforceReportSummary(rows);
      expect(summary.activeWorkersCount).toBe(2);
      expect(summary.totalTasksHandled).toBe(18);
      expect(summary.totalVisitsDispatched).toBe(9);
      expect(summary.totalRecordedActivities).toBe(83);
    });
  });

  describe('Reporting RBAC Permissions', () => {
    it('denies Field Worker report viewing and exporting', () => {
      expect(can(UserRole.FIELD_WORKER, Permissions.REPORT_VIEW)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.REPORT_EXPORT)).toBe(false);
    });

    it('allows Supervisor to view reports but restricts CSV exporting', () => {
      expect(can(UserRole.SUPERVISOR, Permissions.REPORT_VIEW)).toBe(true);
      expect(can(UserRole.SUPERVISOR, Permissions.REPORT_EXPORT)).toBe(false);
    });

    it('allows Manager, Admin, and Owner to view and export reports', () => {
      expect(can(UserRole.MANAGER, Permissions.REPORT_VIEW)).toBe(true);
      expect(can(UserRole.MANAGER, Permissions.REPORT_EXPORT)).toBe(true);

      expect(can(UserRole.ADMIN, Permissions.REPORT_VIEW)).toBe(true);
      expect(can(UserRole.ADMIN, Permissions.REPORT_EXPORT)).toBe(true);

      expect(can(UserRole.OWNER, Permissions.REPORT_VIEW)).toBe(true);
      expect(can(UserRole.OWNER, Permissions.REPORT_EXPORT)).toBe(true);
    });
  });
});
