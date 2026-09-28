import {
  TaskReportRow,
  TaskReportSummary,
  TaskStatus,
  VisitReportRow,
  VisitReportSummary,
  VisitStatus,
  LocationVerificationResult,
  AttendanceReportRow,
  AttendanceReportSummary,
  AttendanceStatus,
  WorkforceReportRow,
  WorkforceReportSummary,
} from '@fieldops/types';

/**
 * Calculates summary KPIs for a Task Report according to product specifications.
 * Active tasks exclude CANCELED tasks.
 */
export function calculateTaskReportSummary(rows: readonly TaskReportRow[]): TaskReportSummary {
  const activeTasks = rows.filter((r) => r.status !== TaskStatus.CANCELED);
  const totalTasks = activeTasks.length;
  const completedTasks = activeTasks.filter((r) => r.status === TaskStatus.COMPLETED).length;
  const inProgressTasks = activeTasks.filter(
    (r) => r.status === TaskStatus.IN_PROGRESS || r.status === TaskStatus.ACCEPTED
  ).length;
  const blockedTasks = activeTasks.filter((r) => r.status === TaskStatus.BLOCKED).length;

  const nowMs = Date.now();
  const overdueTasks = activeTasks.filter((r) => {
    if (r.status === TaskStatus.COMPLETED) return false;
    if (!r.dueAt) return false;
    return new Date(r.dueAt).getTime() < nowMs;
  }).length;

  const completionRatePercentage =
    totalTasks > 0 ? Math.min(100, Math.round((completedTasks / totalTasks) * 100)) : 0;

  return {
    totalTasks,
    completedTasks,
    completionRatePercentage,
    inProgressTasks,
    overdueTasks,
    blockedTasks,
  };
}

/**
 * Calculates summary KPIs for a Visit Report according to product specifications.
 * Scheduled visits exclude CANCELED visits.
 */
export function calculateVisitReportSummary(rows: readonly VisitReportRow[]): VisitReportSummary {
  const scheduledVisits = rows.filter((r) => r.status !== VisitStatus.CANCELED);
  const totalScheduled = scheduledVisits.length;
  const completedVisits = scheduledVisits.filter((r) => r.status === VisitStatus.COMPLETED).length;
  const missedVisits = scheduledVisits.filter((r) => r.status === VisitStatus.MISSED).length;

  // On-time check-in rate: checkInAt <= scheduledStart (+ 5m tolerance)
  const checkedInVisits = scheduledVisits.filter((r) => !!r.checkedInAt);
  const onTimeVisits = checkedInVisits.filter((r) => {
    if (!r.checkedInAt || !r.scheduledStart) return false;
    const checkInMs = new Date(r.checkedInAt).getTime();
    const scheduledStartMs = new Date(r.scheduledStart).getTime() + 5 * 60 * 1000; // 5 min tolerance
    return checkInMs <= scheduledStartMs;
  }).length;

  const onTimeCheckInRatePercentage =
    checkedInVisits.length > 0 ? Math.min(100, Math.round((onTimeVisits / checkedInVisits.length) * 100)) : 0;

  // Geofence verification rate
  const verifiedVisits = checkedInVisits.filter(
    (r) => r.verificationResult === LocationVerificationResult.VALID
  ).length;

  const geofenceVerificationRatePercentage =
    checkedInVisits.length > 0 ? Math.min(100, Math.round((verifiedVisits / checkedInVisits.length) * 100)) : 0;

  return {
    totalScheduled,
    completedVisits,
    onTimeCheckInRatePercentage,
    geofenceVerificationRatePercentage,
    missedVisits,
  };
}

/**
 * Calculates summary KPIs for an Attendance Report according to product specifications.
 */
export function calculateAttendanceReportSummary(rows: readonly AttendanceReportRow[]): AttendanceReportSummary {
  const totalShifts = rows.length;
  const completedShifts = rows.filter(
    (r) => r.status === AttendanceStatus.CLOCKED_OUT || r.status === AttendanceStatus.CORRECTED
  ).length;

  const totalDurationSeconds = rows.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);
  const totalDutyHours = Math.round((totalDurationSeconds / 3600) * 10) / 10;

  const adjustedShifts = rows.filter(
    (r) => r.isManuallyAdjusted || r.status === AttendanceStatus.CORRECTED
  ).length;

  const manualAdjustmentRatePercentage =
    totalShifts > 0 ? Math.min(100, Math.round((adjustedShifts / totalShifts) * 100)) : 0;

  return {
    totalShifts,
    completedShifts,
    totalDutyHours,
    manualAdjustmentRatePercentage,
  };
}

/**
 * Calculates summary KPIs for a Workforce Report according to product specifications.
 */
export function calculateWorkforceReportSummary(rows: readonly WorkforceReportRow[]): WorkforceReportSummary {
  const activeWorkersCount = rows.length;
  const totalTasksHandled = rows.reduce((acc, r) => acc + r.assignedTasksCount, 0);
  const totalVisitsDispatched = rows.reduce((acc, r) => acc + r.scheduledVisitsCount, 0);
  const totalRecordedActivities = rows.reduce((acc, r) => acc + r.totalActivitiesCount, 0);

  return {
    activeWorkersCount,
    totalTasksHandled,
    totalVisitsDispatched,
    totalRecordedActivities,
  };
}

/**
 * Common date range presets in ISO YYYY-MM-DD.
 */
export function getDefaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30); // Last 30 days by default

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}
