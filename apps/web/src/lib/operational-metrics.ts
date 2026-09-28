import {
  Task,
  TaskStatus,
  Visit,
  VisitStatus,
  AttendanceRecord,
  AttendanceStatus,
  Priority,
  isTaskOverdue,
  isVisitOverdue,
  TenantId,
} from '@fieldops/types';

export interface DashboardKPIs {
  tasksToday: number;
  tasksOverdue: number;
  tasksCompletedToday: number;
  tasksBlocked: number;
  visitsToday: number;
  visitsActive: number;
  visitsCompletedToday: number;
  visitsOverdue: number;
  activeWorkers: number;
  totalFieldWorkers: number;
  attendanceRate: number; // 0 to 100
  operationalExceptions: number;
}

export interface OperationalExceptionItem {
  id: string;
  type: 'TASK_BLOCKED' | 'TASK_OVERDUE' | 'VISIT_MISSED' | 'GEOFENCE_VIOLATION' | 'LOW_ACCURACY';
  title: string;
  subtitle: string;
  severity: 'HIGH' | 'MEDIUM' | 'CRITICAL';
  timestamp: string;
  linkHref: string;
}

/**
 * Returns YYYY-MM-DD for a given Date or ISO string in UTC or target timezone.
 */
export function getLocalDateString(dateInput: Date | string = new Date()): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

/**
 * Checks whether an ISO timestamp falls on a target YYYY-MM-DD date.
 */
export function isSameDate(isoString: string | null | undefined, targetDateStr: string): boolean {
  if (!isoString) return false;
  return isoString.startsWith(targetDateStr);
}

/**
 * Computes all dashboard KPIs deterministically from active entity sets.
 */
export function calculateDashboardKPIs(params: {
  tasks: readonly Task[];
  visits: readonly Visit[];
  attendanceRecords: readonly AttendanceRecord[];
  totalFieldWorkersCount?: number;
  todayDateStr?: string;
  referenceNow?: Date;
}): DashboardKPIs {
  const now = params.referenceNow || new Date();
  const todayStr = params.todayDateStr || getLocalDateString(now);
  const totalFieldWorkers = params.totalFieldWorkersCount || 0;

  // 1. Tasks Metrics
  let tasksToday = 0;
  let tasksOverdue = 0;
  let tasksCompletedToday = 0;
  let tasksBlocked = 0;

  for (const t of params.tasks) {
    // Check if task is today
    const dueToday = t.dueAt && isSameDate(t.dueAt, todayStr);
    const createdToday = !t.dueAt && isSameDate(t.createdAt, todayStr);
    if (dueToday || createdToday) {
      tasksToday++;
      if (t.status === TaskStatus.COMPLETED) {
        tasksCompletedToday++;
      }
    }

    if (t.status === TaskStatus.BLOCKED) {
      tasksBlocked++;
    }

    if (isTaskOverdue(t, now)) {
      tasksOverdue++;
    }
  }

  // 2. Visits Metrics
  let visitsToday = 0;
  let visitsActive = 0;
  let visitsCompletedToday = 0;
  let visitsOverdue = 0;

  for (const v of params.visits) {
    const isToday = isSameDate(v.scheduledStart, todayStr);
    if (isToday) {
      visitsToday++;
      if (v.status === VisitStatus.CHECKED_IN || v.status === VisitStatus.IN_PROGRESS) {
        visitsActive++;
      }
      if (v.status === VisitStatus.CHECKED_OUT || v.status === VisitStatus.COMPLETED) {
        visitsCompletedToday++;
      }
    }

    if (v.status === VisitStatus.MISSED || isVisitOverdue(v, now)) {
      visitsOverdue++;
    }
  }

  // 3. Attendance Metrics
  let activeWorkers = 0;
  for (const a of params.attendanceRecords) {
    if (a.date === todayStr && a.status === AttendanceStatus.CLOCKED_IN && !a.checkOutAt) {
      activeWorkers++;
    }
  }

  const attendanceRate = totalFieldWorkers > 0
    ? Math.round((activeWorkers / totalFieldWorkers) * 100)
    : (activeWorkers > 0 ? 100 : 0);

  // 4. Exceptions
  const exceptions = tasksBlocked + tasksOverdue + visitsOverdue;

  return {
    tasksToday,
    tasksOverdue,
    tasksCompletedToday,
    tasksBlocked,
    visitsToday,
    visitsActive,
    visitsCompletedToday,
    visitsOverdue,
    activeWorkers,
    totalFieldWorkers,
    attendanceRate,
    operationalExceptions: exceptions,
  };
}

/**
 * Extracts and categorizes individual operational exception items for display.
 */
export function extractOperationalExceptions(params: {
  tasks: readonly Task[];
  visits: readonly Visit[];
  attendanceRecords?: readonly AttendanceRecord[];
  referenceNow?: Date;
}): readonly OperationalExceptionItem[] {
  const now = params.referenceNow || new Date();
  const items: OperationalExceptionItem[] = [];

  // Blocked Tasks
  for (const t of params.tasks) {
    if (t.status === TaskStatus.BLOCKED) {
      items.push({
        id: `blocked-task-${t.id}`,
        type: 'TASK_BLOCKED',
        title: `Task Blocked: ${t.title}`,
        subtitle: t.description ? t.description.slice(0, 80) : 'Requires supervisor assistance',
        severity: t.priority === Priority.URGENT ? 'CRITICAL' : 'HIGH',
        timestamp: t.updatedAt,
        linkHref: `/tasks/${t.id}`,
      });
    }
  }

  // Overdue Tasks
  for (const t of params.tasks) {
    if (isTaskOverdue(t, now)) {
      items.push({
        id: `overdue-task-${t.id}`,
        type: 'TASK_OVERDUE',
        title: `Task Overdue: ${t.title}`,
        subtitle: `Due ${t.dueAt ? new Date(t.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'earlier'}`,
        severity: t.priority === Priority.URGENT ? 'CRITICAL' : 'HIGH',
        timestamp: t.dueAt || t.updatedAt,
        linkHref: `/tasks/${t.id}`,
      });
    }
  }

  // Missed or Overdue Visits
  for (const v of params.visits) {
    if (v.status === VisitStatus.MISSED || isVisitOverdue(v, now)) {
      items.push({
        id: `overdue-visit-${v.id}`,
        type: 'VISIT_MISSED',
        title: `Visit Exception: ${v.status === VisitStatus.MISSED ? 'Missed Visit' : 'Overdue Start'}`,
        subtitle: `Scheduled: ${new Date(v.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        severity: 'MEDIUM',
        timestamp: v.scheduledStart,
        linkHref: `/visits/${v.id}`,
      });
    }
  }

  // Sort exceptions: CRITICAL first, then HIGH, then MEDIUM, descending timestamp
  const severityRank: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };
  items.sort((a, b) => {
    const diff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
    if (diff !== 0) return diff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return items;
}
