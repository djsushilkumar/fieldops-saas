'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import {
  getMembershipService,
  getAttendanceService,
  getTaskService,
  getVisitService,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Membership,
  AttendanceRecord,
  AttendanceStatus,
  Task,
  TaskStatus,
  Visit,
  UserRole,
  can,
  Permissions,
} from '@fieldops/types';
import { getLocalDateString } from '@/lib/operational-metrics';

interface WorkerCardData {
  membership: Membership;
  attendanceRecord?: AttendanceRecord;
  openTasksCount: number;
  visitsTodayCount: number;
}

export default function EmployeesPage() {
  const { activeRole } = useAuth();
  const { activeOrganization } = useOrganization();

  const role = activeRole || UserRole.FIELD_WORKER;
  const canManageMembers = can(role, Permissions.MEMBER_INVITE);

  const [members, setMembers] = useState<readonly Membership[]>([]);
  const [attendance, setAttendance] = useState<readonly AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<readonly Task[]>([]);
  const [visits, setVisits] = useState<readonly Visit[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const todayStr = getLocalDateString();

  const loadWorkforceData = useCallback(async () => {
    if (!activeOrganization) return;
    setIsLoading(true);
    setErrorMessage(null);

    const membershipService = getMembershipService();
    const attendanceService = getAttendanceService();
    const taskService = getTaskService();
    const visitService = getVisitService();

    try {
      const [membersRes, attendanceRes, tasksRes, visitsRes] = await Promise.all([
        membershipService.listMembers(activeOrganization.id),
        attendanceService.listAttendance({ date: todayStr }, { page: 1, pageSize: 100 }),
        taskService.listTasks(undefined, { page: 1, pageSize: 100 }),
        visitService.listVisits(undefined, { page: 1, pageSize: 100 }),
      ]);

      setMembers(membersRes || []);
      setAttendance(attendanceRes.items || []);
      setTasks(tasksRes.items || []);
      setVisits(visitsRes.items || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load workforce directory.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganization, todayStr]);

  useEffect(() => {
    loadWorkforceData();
  }, [loadWorkforceData]);

  // Combine data per member
  const workforceList: WorkerCardData[] = useMemo(() => {
    return members.map((m) => {
      const att = attendance.find((a) => a.userId === m.userId);
      const openTasks = tasks.filter(
        (t) =>
          t.assignedTo === m.userId &&
          t.status !== TaskStatus.COMPLETED &&
          t.status !== TaskStatus.CANCELED
      ).length;

      const visitsToday = visits.filter(
        (v) =>
          v.assignedTo === m.userId &&
          v.scheduledStart &&
          v.scheduledStart.startsWith(todayStr)
      ).length;

      return {
        membership: m,
        attendanceRecord: att,
        openTasksCount: openTasks,
        visitsTodayCount: visitsToday,
      };
    });
  }, [members, attendance, tasks, visits, todayStr]);

  // Filtered workers
  const filteredWorkforce = useMemo(() => {
    return workforceList.filter((item) => {
      const name = item.membership.user?.fullName || '';
      const email = item.membership.user?.email || '';
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (roleFilter !== 'ALL' && item.membership.role !== roleFilter) {
        return false;
      }

      if (statusFilter !== 'ALL') {
        const isClockedIn =
          item.attendanceRecord?.status === AttendanceStatus.CLOCKED_IN &&
          !item.attendanceRecord?.checkOutAt;
        if (statusFilter === 'CLOCKED_IN' && !isClockedIn) return false;
        if (statusFilter === 'NOT_CLOCKED_IN' && isClockedIn) return false;
      }

      return true;
    });
  }, [workforceList, searchQuery, roleFilter, statusFilter]);

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
              Workforce Operations
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {members.length} Members
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary">
            Employees & Workforce Roster
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Monitor real-time shift status, active operational workload, and crew availability.
          </p>
        </div>

        {canManageMembers && (
          <Link href="/organization/members">
            <Button variant="primary" className="h-8 px-3 text-xs">
              + Invite Member
            </Button>
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by worker name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 rounded-lg border border-input bg-surface px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-input bg-surface px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="ALL">All Roles</option>
            {Object.values(UserRole).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-input bg-surface px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="ALL">All Duty Statuses</option>
            <option value="CLOCKED_IN">Clocked In Now</option>
            <option value="NOT_CLOCKED_IN">Not Clocked In</option>
          </select>
        </div>

        <span className="text-text-muted font-medium">
          Showing {filteredWorkforce.length} of {members.length} workers
        </span>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {errorMessage}
        </div>
      )}

      {/* Workforce Grid */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-xs text-text-muted">
          Loading workforce roster...
        </div>
      ) : filteredWorkforce.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-xs text-text-muted">
          <p className="font-semibold text-slate-700">No workforce members match your search criteria</p>
          <p className="mt-1">Try clearing filters or invite new team members.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWorkforce.map(({ membership: m, attendanceRecord: att, openTasksCount, visitsTodayCount }) => {
            const isClockedIn = att?.status === AttendanceStatus.CLOCKED_IN && !att?.checkOutAt;

            return (
              <div
                key={m.id}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm hover:border-slate-300 transition-colors"
              >
                {/* Worker Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-sm text-primary">
                      {m.user?.fullName || 'Worker Profile'}
                    </h2>
                    <p className="text-xs text-text-muted">{m.user?.email || m.userId.slice(0, 12)}</p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      m.role === UserRole.OWNER
                        ? 'bg-purple-100 text-purple-800'
                        : m.role === UserRole.ADMIN
                        ? 'bg-blue-100 text-blue-800'
                        : m.role === UserRole.MANAGER || m.role === UserRole.SUPERVISOR
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {m.role}
                  </span>
                </div>

                {/* Duty & Shift Status */}
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-text-muted font-medium">Shift Status:</span>
                  {isClockedIn ? (
                    <span className="flex items-center gap-1.5 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      CLOCKED IN (since {new Date(att.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </span>
                  ) : att?.checkOutAt ? (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      COMPLETED SHIFT
                    </span>
                  ) : (
                    <span className="rounded bg-slate-50 px-2 py-0.5 text-[10px] text-slate-400">
                      OFF DUTY
                    </span>
                  )}
                </div>

                {/* Workload Metrics */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <span className="text-[10px] uppercase font-bold text-text-muted">Open Tasks</span>
                    <div className="mt-0.5 font-bold text-sm text-primary">{openTasksCount}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <span className="text-[10px] uppercase font-bold text-text-muted">Visits Today</span>
                    <div className="mt-0.5 font-bold text-sm text-primary">{visitsTodayCount}</div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-end gap-2 text-xs">
                  <Link href={`/tasks?assignedTo=${m.userId}`}>
                    <Button variant="secondary" className="h-7 px-2 text-xs">
                      Tasks
                    </Button>
                  </Link>
                  <Link href={`/attendance?userId=${m.userId}`}>
                    <Button variant="secondary" className="h-7 px-2 text-xs">
                      Attendance
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
