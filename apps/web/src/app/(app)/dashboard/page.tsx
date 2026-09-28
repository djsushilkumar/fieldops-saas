'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import {
  getTaskService,
  getVisitService,
  getAttendanceService,
  getMembershipService,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  can,
  Permissions,
  UserRole,
  Task,
  TaskStatus,
  Visit,
  VisitStatus,
  AttendanceRecord,
  AttendanceStatus,
  Membership,
  Priority,
} from '@fieldops/types';
import {
  calculateDashboardKPIs,
  extractOperationalExceptions,
  getLocalDateString,
  DashboardKPIs,
  OperationalExceptionItem,
} from '@/lib/operational-metrics';
import { useTenantRealtime } from '@/lib/realtime';

export default function DashboardPage() {
  const { user, activeMembership, activeRole } = useAuth();
  const { activeOrganization, isLoading: orgLoading } = useOrganization();

  const role = activeRole || UserRole.FIELD_WORKER;
  const canCreateTask = can(role, Permissions.TASK_CREATE);
  const canScheduleVisit = can(role, Permissions.VISIT_SCHEDULE);
  const canViewWorkforce = can(role, Permissions.MEMBER_PROFILE_VIEW_TEAM);
  const canManageMembers = can(role, Permissions.MEMBER_INVITE);

  const [dateStr, setDateStr] = useState<string>(getLocalDateString());
  const [tasks, setTasks] = useState<readonly Task[]>([]);
  const [visits, setVisits] = useState<readonly Visit[]>([]);
  const [attendance, setAttendance] = useState<readonly AttendanceRecord[]>([]);
  const [members, setMembers] = useState<readonly Membership[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subscribe to real-time events for this tenant
  useTenantRealtime(activeOrganization?.id, () => {
    fetchDashboardData(true);
  });

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!activeOrganization) return;
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMessage(null);

    const taskService = getTaskService();
    const visitService = getVisitService();
    const attendanceService = getAttendanceService();
    const membershipService = getMembershipService();

    try {
      const [tasksRes, visitsRes, attendanceRes, membersRes] = await Promise.all([
        taskService.listTasks(undefined, { page: 1, pageSize: 100 }),
        visitService.listVisits(undefined, { page: 1, pageSize: 100 }),
        attendanceService.listAttendance({ date: dateStr }, { page: 1, pageSize: 100 }),
        membershipService.listMembers(activeOrganization.id).catch(() => [] as readonly Membership[]),
      ]);

      setTasks(tasksRes.items || []);
      setVisits(visitsRes.items || []);
      setAttendance(attendanceRes.items || []);
      setMembers(membersRes || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load operational data.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeOrganization, dateStr]);

  useEffect(() => {
    if (activeOrganization) {
      fetchDashboardData();
    }
  }, [activeOrganization, fetchDashboardData]);

  // Derive field worker count from members
  const fieldWorkers = members.filter(
    (m) => m.role === UserRole.FIELD_WORKER && m.status === 'ACTIVE'
  );
  const totalFieldWorkersCount = fieldWorkers.length > 0 ? fieldWorkers.length : attendance.length;

  const kpis: DashboardKPIs = calculateDashboardKPIs({
    tasks,
    visits,
    attendanceRecords: attendance,
    totalFieldWorkersCount,
    todayDateStr: dateStr,
  });

  const exceptions: readonly OperationalExceptionItem[] = extractOperationalExceptions({
    tasks,
    visits,
    attendanceRecords: attendance,
  });

  // Today's upcoming/active visits
  const todayVisits = visits.filter(
    (v) => v.scheduledStart && v.scheduledStart.startsWith(dateStr)
  );
  const activeOrUpcomingVisits = todayVisits
    .filter((v) => v.status !== VisitStatus.COMPLETED && v.status !== VisitStatus.CANCELED)
    .slice(0, 5);

  // Overdue or Blocked tasks requiring attention
  const urgentTasks = tasks
    .filter(
      (t) =>
        t.status === TaskStatus.BLOCKED ||
        (t.dueAt && new Date(t.dueAt).getTime() < Date.now() && t.status !== TaskStatus.COMPLETED)
    )
    .slice(0, 5);

  // Active clocked-in workers
  const clockedInRecords = attendance.filter(
    (a) => a.status === AttendanceStatus.CLOCKED_IN && !a.checkOutAt
  );

  return (
    <div className="mx-auto max-w-7xl p-6 sm:p-8 space-y-8">
      {/* Top Banner & Operational Context */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                Operations Control Center
              </span>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                LIVE TENANT ISOLATED
              </span>
              {isRefreshing && (
                <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 animate-pulse">
                  Syncing updates...
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary">
              {orgLoading ? 'Loading workspace...' : activeOrganization?.name || 'FieldOps Tenant'}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-muted">
              <span>
                Tenant ID: <code className="font-mono text-[11px]">{activeMembership?.organizationId}</code>
              </span>
              <span>•</span>
              <span>
                Role: <strong className="text-foreground">{role}</strong>
              </span>
              <span>•</span>
              <span>
                Plan: <strong className="text-foreground">{activeOrganization?.subscriptionTier || 'PRO'}</strong>
              </span>
            </div>
          </div>

          {/* Quick Dispatch Actions & Date Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-slate-50 px-3 py-1.5 text-xs">
              <span className="text-text-muted font-medium">Date:</span>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="bg-transparent font-semibold text-primary focus:outline-none cursor-pointer"
              />
            </div>

            <Button
              variant="secondary"
              onClick={() => fetchDashboardData()}
              disabled={isLoading || isRefreshing}
              className="text-xs h-9 px-3"
            >
              ↻ Refresh
            </Button>

            {canCreateTask && (
              <Link href="/tasks">
                <Button variant="primary" className="text-xs h-9 px-3">
                  + Create Task
                </Button>
              </Link>
            )}

            {canScheduleVisit && (
              <Link href="/visits">
                <Button variant="secondary" className="text-xs h-9 px-3">
                  + Schedule Visit
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between">
          <div>
            <strong className="font-semibold">Operational Error:</strong> {errorMessage}
          </div>
          <Button variant="secondary" onClick={() => fetchDashboardData()} className="h-7 px-2 text-xs">
            Retry
          </Button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* Tasks Today */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-slate-300 transition-colors">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Tasks Today
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-primary">
              {isLoading ? '...' : kpis.tasksToday}
            </span>
            <span className="text-[11px] font-medium text-emerald-600">
              {kpis.tasksCompletedToday} Done
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{
                width: `${kpis.tasksToday > 0 ? (kpis.tasksCompletedToday / kpis.tasksToday) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Tasks Overdue */}
        <div
          className={`rounded-xl border p-4 shadow-sm transition-colors ${
            kpis.tasksOverdue > 0
              ? 'border-rose-200 bg-rose-50/40 text-rose-900'
              : 'border-border bg-surface'
          }`}
        >
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Tasks Overdue
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold tracking-tight ${
                kpis.tasksOverdue > 0 ? 'text-rose-600' : 'text-primary'
              }`}
            >
              {isLoading ? '...' : kpis.tasksOverdue}
            </span>
            {kpis.tasksOverdue > 0 && (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                ACTION REQUIRED
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            {kpis.tasksOverdue === 0 ? 'All tasks on schedule' : 'Breached SLA deadline'}
          </p>
        </div>

        {/* Visits Today */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-slate-300 transition-colors">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Visits Today
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-primary">
              {isLoading ? '...' : kpis.visitsToday}
            </span>
            <span className="text-[11px] font-medium text-blue-600">
              {kpis.visitsActive} Active
            </span>
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            {kpis.visitsCompletedToday} completed today
          </p>
        </div>

        {/* Active Field Workers */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-slate-300 transition-colors">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Active Workers
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-primary">
              {isLoading ? '...' : kpis.activeWorkers}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              of {kpis.totalFieldWorkers || kpis.activeWorkers} total
            </span>
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            Currently clocked in
          </p>
        </div>

        {/* Attendance Rate */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-slate-300 transition-colors">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Attendance Rate
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-primary">
              {isLoading ? '...' : `${kpis.attendanceRate}%`}
            </span>
            <span className="text-[11px] font-medium text-emerald-600">
              Shift Today
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-primary rounded-full transition-all"
              style={{ width: `${kpis.attendanceRate}%` }}
            />
          </div>
        </div>

        {/* Operational Exceptions */}
        <div
          className={`rounded-xl border p-4 shadow-sm transition-colors ${
            kpis.operationalExceptions > 0
              ? 'border-amber-200 bg-amber-50/40 text-amber-900'
              : 'border-border bg-surface'
          }`}
        >
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Exceptions
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold tracking-tight ${
                kpis.operationalExceptions > 0 ? 'text-amber-600' : 'text-primary'
              }`}
            >
              {isLoading ? '...' : kpis.operationalExceptions}
            </span>
            {kpis.operationalExceptions > 0 ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                ATTENTION
              </span>
            ) : (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                OPTIMAL
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            {kpis.operationalExceptions === 0 ? 'No operational blockers' : 'Blocked / Overdue items'}
          </p>
        </div>
      </div>

      {/* Operational Exceptions List (if any exist) */}
      {exceptions.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-amber-200/60">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h2 className="text-sm font-bold text-amber-950 uppercase tracking-wider">
                Operational Exceptions Requiring Attention ({exceptions.length})
              </h2>
            </div>
            <span className="text-xs text-amber-800">
              Immediate Supervisor Action Required
            </span>
          </div>

          <div className="mt-4 divide-y divide-amber-100">
            {exceptions.slice(0, 4).map((ex) => (
              <div key={ex.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      ex.severity === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800'
                        : ex.severity === 'HIGH'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    {ex.severity}
                  </span>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">{ex.title}</h3>
                    <p className="text-[11px] text-slate-500">{ex.subtitle}</p>
                  </div>
                </div>
                <Link href={ex.linkHref}>
                  <Button variant="secondary" className="h-7 px-2.5 text-xs text-slate-700">
                    Review →
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Operations Grid: Today's Work & Workforce Snapshot */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Active & Upcoming Visits (2 Columns on large screens) */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <h2 className="text-base font-bold text-primary">Today&apos;s Field Operations</h2>
              <p className="text-xs text-text-muted">
                Scheduled client site visits and dispatch progression for {dateStr}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/calendar">
                <Button variant="secondary" className="h-7 px-2 text-xs">
                  Calendar
                </Button>
              </Link>
              <Link href="/map">
                <Button variant="secondary" className="h-7 px-2 text-xs">
                  Live Map
                </Button>
              </Link>
              <Link href="/visits">
                <Button variant="secondary" className="h-7 px-2 text-xs">
                  View All ({todayVisits.length})
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-text-muted">Loading today&apos;s visits...</div>
            ) : activeOrUpcomingVisits.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-muted">
                <p className="font-semibold text-slate-700">No active or scheduled visits for today</p>
                <p className="mt-1">All visits are completed or none have been dispatched.</p>
                {canScheduleVisit && (
                  <div className="mt-4">
                    <Link href="/visits">
                      <Button variant="primary" className="h-8 text-xs">
                        + Schedule Field Visit
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activeOrUpcomingVisits.map((visit) => (
                  <div key={visit.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-primary">
                          Visit at Location #{visit.locationId.slice(0, 8)}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            visit.status === VisitStatus.IN_PROGRESS || visit.status === VisitStatus.CHECKED_IN
                              ? 'bg-blue-100 text-blue-800'
                              : visit.status === VisitStatus.READY
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {visit.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        Scheduled: {new Date(visit.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                        • Assignee: {visit.assignedTo ? `Worker #${visit.assignedTo.slice(0, 8)}` : 'Unassigned'}
                      </p>
                    </div>

                    <Link href={`/visits/${visit.id}`}>
                      <Button variant="secondary" className="h-7 px-2.5 text-xs">
                        Details
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Workforce Snapshot (1 Column) */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <h2 className="text-base font-bold text-primary">Workforce Snapshot</h2>
              <p className="text-xs text-text-muted">Active duty and shift statuses.</p>
            </div>
            {canViewWorkforce && (
              <Link href="/attendance">
                <Button variant="secondary" className="h-7 px-2 text-xs">
                  Shift Board
                </Button>
              </Link>
            )}
          </div>

          <div className="mt-4">
            <div className="rounded-lg bg-slate-50 p-3 text-xs mb-4">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Clocked In Now:</span>
                <strong className="text-emerald-700 font-bold">{clockedInRecords.length} Workers</strong>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-text-muted">Shift Compliance:</span>
                <strong className="text-primary font-bold">{kpis.attendanceRate}%</strong>
              </div>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-xs text-text-muted">Loading attendance...</div>
            ) : clockedInRecords.length === 0 ? (
              <div className="py-8 text-center text-xs text-text-muted">
                <p className="font-semibold text-slate-700">No workers currently clocked in</p>
                <p className="mt-1">Field workers clock in from the mobile application.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {clockedInRecords.slice(0, 5).map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-primary">
                        {rec.userName || `Worker #${rec.userId.slice(0, 8)}`}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        In since {new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ON DUTY
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-border">
              <Link href="/employees">
                <Button variant="secondary" className="w-full text-xs">
                  View Full Workforce Directory →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Urgent & Overdue Tasks Section */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-primary">Priority Tasks Requiring Attention</h2>
            <p className="text-xs text-text-muted">Overdue assignments, blocked work, and high-priority tickets.</p>
          </div>
          <Link href="/tasks">
            <Button variant="secondary" className="h-7 px-2.5 text-xs">
              View All Tasks ({tasks.length})
            </Button>
          </Link>
        </div>

        <div className="mt-4">
          {urgentTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">
              <p className="font-semibold text-slate-700">No blocked or overdue tasks</p>
              <p className="mt-1">All assigned work is on track.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {urgentTasks.map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/tasks/${t.id}`} className="font-semibold text-xs text-primary hover:underline">
                        {t.title}
                      </Link>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          t.status === TaskStatus.BLOCKED
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t.status}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700">
                        {t.priority}
                      </span>
                    </div>
                    {t.description && (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-text-muted max-w-xl">
                        {t.description}
                      </p>
                    )}
                  </div>

                  <Link href={`/tasks/${t.id}`}>
                    <Button variant="secondary" className="h-7 px-2.5 text-xs">
                      Resolve →
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
