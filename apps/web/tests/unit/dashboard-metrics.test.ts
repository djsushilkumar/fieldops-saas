import { describe, it, expect } from 'vitest';
import {
  calculateDashboardKPIs,
  extractOperationalExceptions,
  getLocalDateString,
  isSameDate,
} from '../../src/lib/operational-metrics';
import {
  Task,
  TaskStatus,
  Visit,
  VisitStatus,
  AttendanceRecord,
  AttendanceStatus,
  Priority,
  TenantId,
  TaskId,
  VisitId,
  AttendanceId,
  UserId,
} from '@fieldops/types';

describe('Dashboard Metrics & Operational KPIs Unit Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001' as TenantId;
  const mockNow = new Date('2026-09-28T14:00:00.000Z');
  const todayStr = '2026-09-28';

  const sampleTasks: any[] = [
    {
      id: 'task-1' as TaskId,
      organizationId: tenantId,
      title: 'Inspect pump #4',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      dueAt: '2026-09-28T16:00:00.000Z',
      createdAt: '2026-09-28T09:00:00.000Z',
      updatedAt: '2026-09-28T09:00:00.000Z',
      version: 1,
    },
    {
      id: 'task-2' as TaskId,
      organizationId: tenantId,
      title: 'Replace circuit breaker',
      status: TaskStatus.BLOCKED,
      priority: Priority.URGENT,
      dueAt: '2026-09-28T11:00:00.000Z',
      createdAt: '2026-09-28T08:00:00.000Z',
      updatedAt: '2026-09-28T10:00:00.000Z',
      version: 2,
    },
    {
      id: 'task-3' as TaskId,
      organizationId: tenantId,
      title: 'Completed maintenance',
      status: TaskStatus.COMPLETED,
      priority: Priority.MEDIUM,
      dueAt: '2026-09-28T12:00:00.000Z',
      createdAt: '2026-09-28T07:00:00.000Z',
      updatedAt: '2026-09-28T12:30:00.000Z',
      version: 3,
    },
    {
      id: 'task-4' as TaskId,
      organizationId: tenantId,
      title: 'Future scheduled repair',
      status: TaskStatus.ASSIGNED,
      priority: Priority.LOW,
      dueAt: '2026-09-29T10:00:00.000Z',
      createdAt: '2026-09-28T08:00:00.000Z',
      updatedAt: '2026-09-28T08:00:00.000Z',
      version: 1,
    },
  ];

  const sampleVisits: any[] = [
    {
      id: 'vis-1' as VisitId,
      organizationId: tenantId,
      locationId: 'loc-1' as any,
      scheduledStart: '2026-09-28T10:00:00.000Z',
      scheduledEnd: '2026-09-28T15:00:00.000Z',
      status: VisitStatus.CHECKED_IN,
      version: 1,
      createdAt: '2026-09-28T08:00:00.000Z',
      updatedAt: '2026-09-28T10:05:00.000Z',
    },
    {
      id: 'vis-2' as VisitId,
      organizationId: tenantId,
      locationId: 'loc-2' as any,
      scheduledStart: '2026-09-28T15:00:00.000Z',
      scheduledEnd: '2026-09-28T16:00:00.000Z',
      status: VisitStatus.SCHEDULED,
      version: 1,
      createdAt: '2026-09-28T08:00:00.000Z',
      updatedAt: '2026-09-28T08:00:00.000Z',
    },
    {
      id: 'vis-3' as VisitId,
      organizationId: tenantId,
      locationId: 'loc-3' as any,
      scheduledStart: '2026-09-28T09:00:00.000Z',
      scheduledEnd: '2026-09-28T10:00:00.000Z',
      status: VisitStatus.MISSED,
      version: 1,
      createdAt: '2026-09-28T08:00:00.000Z',
      updatedAt: '2026-09-28T10:30:00.000Z',
    },
  ];

  const sampleAttendance: any[] = [
    {
      id: 'att-1' as AttendanceId,
      organizationId: tenantId,
      userId: 'usr-1' as UserId,
      date: todayStr,
      checkInAt: '2026-09-28T08:00:00.000Z',
      status: AttendanceStatus.CLOCKED_IN,
      isManuallyAdjusted: false,
      createdAt: '2026-09-28T08:00:00.000Z',
      updatedAt: '2026-09-28T08:00:00.000Z',
    },
    {
      id: 'att-2' as AttendanceId,
      organizationId: tenantId,
      userId: 'usr-2' as UserId,
      date: todayStr,
      checkInAt: '2026-09-28T08:30:00.000Z',
      checkOutAt: '2026-09-28T12:30:00.000Z',
      status: AttendanceStatus.CLOCKED_OUT,
      isManuallyAdjusted: false,
      createdAt: '2026-09-28T08:30:00.000Z',
      updatedAt: '2026-09-28T12:30:00.000Z',
    },
  ];

  it('correctly calculates tasks today, overdue tasks, and completed tasks', () => {
    const kpis = calculateDashboardKPIs({
      tasks: sampleTasks,
      visits: sampleVisits,
      attendanceRecords: sampleAttendance,
      totalFieldWorkersCount: 4,
      todayDateStr: todayStr,
      referenceNow: mockNow,
    });

    expect(kpis.tasksToday).toBe(3);
    expect(kpis.tasksCompletedToday).toBe(1);
    expect(kpis.tasksOverdue).toBe(1);
    expect(kpis.tasksBlocked).toBe(1);
  });

  it('correctly calculates visits today, active visits, and missed visits', () => {
    const kpis = calculateDashboardKPIs({
      tasks: sampleTasks,
      visits: sampleVisits,
      attendanceRecords: sampleAttendance,
      totalFieldWorkersCount: 4,
      todayDateStr: todayStr,
      referenceNow: mockNow,
    });

    expect(kpis.visitsToday).toBe(3);
    expect(kpis.visitsActive).toBe(1);
    expect(kpis.visitsOverdue).toBe(1);
  });

  it('accurately calculates active field workers and attendance rate', () => {
    const kpis = calculateDashboardKPIs({
      tasks: sampleTasks,
      visits: sampleVisits,
      attendanceRecords: sampleAttendance,
      totalFieldWorkersCount: 4,
      todayDateStr: todayStr,
      referenceNow: mockNow,
    });

    expect(kpis.activeWorkers).toBe(1);
    expect(kpis.totalFieldWorkers).toBe(4);
    expect(kpis.attendanceRate).toBe(25);
  });

  it('extracts and sorts operational exceptions by severity', () => {
    const exceptions = extractOperationalExceptions({
      tasks: sampleTasks,
      visits: sampleVisits,
      attendanceRecords: sampleAttendance,
      referenceNow: mockNow,
    });

    expect(exceptions.length).toBeGreaterThanOrEqual(2);
    const critical = exceptions.find((e) => e.severity === 'CRITICAL');
    expect(critical).toBeDefined();
    expect(critical?.title).toContain('Replace circuit breaker');
  });

  it('evaluates date helper functions', () => {
    expect(isSameDate('2026-09-28T10:00:00.000Z', '2026-09-28')).toBe(true);
    expect(isSameDate('2026-09-29T10:00:00.000Z', '2026-09-28')).toBe(false);
    expect(isSameDate(null, '2026-09-28')).toBe(false);

    const d = new Date('2026-09-28T05:00:00.000Z');
    expect(getLocalDateString(d)).toBe('2026-09-28');
  });
});
