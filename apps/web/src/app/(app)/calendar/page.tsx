'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { getTaskService, getVisitService, getMembershipService } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Task,
  Visit,
  Membership,
  TaskStatus,
  VisitStatus,
  Priority,
  UserRole,
  can,
  Permissions,
} from '@fieldops/types';
import { getLocalDateString } from '@/lib/operational-metrics';

interface CalendarEvent {
  id: string;
  type: 'TASK' | 'VISIT';
  title: string;
  startTime: string; // ISO string
  endTime?: string;
  status: string;
  priority?: Priority;
  assignedTo?: string;
  linkHref: string;
}

export default function CalendarPage() {
  const { user, activeRole } = useAuth();
  const { activeOrganization } = useOrganization();

  const [viewMode, setViewMode] = useState<'DAY' | 'WEEK'>('WEEK');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [filterType, setFilterType] = useState<'ALL' | 'VISITS' | 'TASKS'>('ALL');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('ALL');

  const [tasks, setTasks] = useState<readonly Task[]>([]);
  const [visits, setVisits] = useState<readonly Visit[]>([]);
  const [members, setMembers] = useState<readonly Membership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const role = activeRole || UserRole.FIELD_WORKER;
  const canScheduleVisit = can(role, Permissions.VISIT_SCHEDULE);
  const canCreateTask = can(role, Permissions.TASK_CREATE);

  // Compute week dates: Monday to Sunday
  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    const curr = new Date(currentDate);
    // Find Monday (day 1)
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diff));

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [currentDate]);

  const dateRangeStr = useMemo(() => {
    if (viewMode === 'DAY') {
      return currentDate.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } else {
      const start = weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const end = weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return `${start} – ${end}`;
    }
  }, [viewMode, currentDate, weekDates]);

  const loadData = useCallback(async () => {
    if (!activeOrganization) return;
    setIsLoading(true);
    setErrorMessage(null);

    const taskService = getTaskService();
    const visitService = getVisitService();
    const membershipService = getMembershipService();

    try {
      const [tasksRes, visitsRes, membersRes] = await Promise.all([
        taskService.listTasks(undefined, { page: 1, pageSize: 100 }),
        visitService.listVisits(undefined, { page: 1, pageSize: 100 }),
        membershipService.listMembers(activeOrganization.id).catch(() => [] as readonly Membership[]),
      ]);

      setTasks(tasksRes.items || []);
      setVisits(visitsRes.items || []);
      setMembers(membersRes || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load calendar events.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Transform tasks and visits into unified CalendarEvents
  const allEvents = useMemo(() => {
    const list: CalendarEvent[] = [];

    if (filterType === 'ALL' || filterType === 'TASKS') {
      tasks.forEach((t) => {
        if (t.dueAt) {
          list.push({
            id: `task-${t.id}`,
            type: 'TASK',
            title: `Task: ${t.title}`,
            startTime: t.dueAt,
            status: t.status,
            priority: t.priority,
            assignedTo: t.assignedTo,
            linkHref: `/tasks/${t.id}`,
          });
        }
      });
    }

    if (filterType === 'ALL' || filterType === 'VISITS') {
      visits.forEach((v) => {
        list.push({
          id: `visit-${v.id}`,
          type: 'VISIT',
          title: `Visit #${v.id.slice(0, 8)}`,
          startTime: v.scheduledStart,
          endTime: v.scheduledEnd || undefined,
          status: v.status,
          assignedTo: v.assignedTo || undefined,
          linkHref: `/visits/${v.id}`,
        });
      });
    }

    return list.filter((ev) => {
      if (selectedAssignee !== 'ALL') {
        return ev.assignedTo === selectedAssignee;
      }
      return true;
    });
  }, [tasks, visits, filterType, selectedAssignee]);

  // Navigate functions
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'DAY') {
      next.setDate(next.getDate() - 1);
    } else {
      next.setDate(next.getDate() - 7);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'DAY') {
      next.setDate(next.getDate() + 1);
    } else {
      next.setDate(next.getDate() + 7);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getDayEvents = (targetDate: Date) => {
    const dayStr = getLocalDateString(targetDate);
    return allEvents
      .filter((ev) => ev.startTime.startsWith(dayStr))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  return (
    <div className="mx-auto max-w-7xl p-6 sm:p-8 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
              Operational Dispatch
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {allEvents.length} Scheduled Items
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary">
            Operations Calendar
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            View scheduled visits and task due dates across your field team.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canScheduleVisit && (
            <Link href="/visits">
              <Button variant="primary" className="h-8 px-3 text-xs">
                + Schedule Visit
              </Button>
            </Link>
          )}
          {canCreateTask && (
            <Link href="/tasks">
              <Button variant="secondary" className="h-8 px-3 text-xs">
                + Create Task
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filter and Date Navigation Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleToday} className="h-8 px-2.5 text-xs font-semibold">
            Today
          </Button>
          <div className="flex items-center rounded-lg border border-border bg-slate-50">
            <button
              onClick={handlePrev}
              className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-l-lg"
              title="Previous"
            >
              ◀
            </button>
            <span className="px-3 py-1 text-xs font-semibold text-primary select-none">
              {dateRangeStr}
            </span>
            <button
              onClick={handleNext}
              className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-r-lg"
              title="Next"
            >
              ▶
            </button>
          </div>
        </div>

        {/* View Toggle and Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-border bg-slate-100 p-0.5">
            <button
              onClick={() => setViewMode('DAY')}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                viewMode === 'DAY'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-text-muted hover:text-primary'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('WEEK')}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                viewMode === 'WEEK'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-text-muted hover:text-primary'
              }`}
            >
              Week
            </button>
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="rounded-lg border border-input bg-surface px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="ALL">All Events</option>
            <option value="VISITS">Visits Only</option>
            <option value="TASKS">Tasks Only</option>
          </select>

          {/* Worker Assignee Filter */}
          {members.length > 0 && (
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="rounded-lg border border-input bg-surface px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              <option value="ALL">All Assignees</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.fullName || m.user?.email || m.userId.slice(0, 8)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {errorMessage}
        </div>
      )}

      {/* Calendar Grid View */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-xs text-text-muted">
          Loading calendar schedule...
        </div>
      ) : viewMode === 'WEEK' ? (
        /* Week Grid */
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-slate-50 text-center text-xs font-semibold text-slate-700">
            {weekDates.map((d, i) => {
              const isToday = getLocalDateString(d) === getLocalDateString(new Date());
              return (
                <div key={i} className={`p-3 border-r last:border-r-0 border-border ${isToday ? 'bg-brand-primary/5 text-brand-primary' : ''}`}>
                  <div className="text-[11px] uppercase tracking-wider text-text-muted">
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </div>
                  <div className={`mt-0.5 text-sm font-bold ${isToday ? 'text-brand-primary' : 'text-primary'}`}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7 min-h-[420px] divide-x divide-border">
            {weekDates.map((d, i) => {
              const dayEvs = getDayEvents(d);
              const isToday = getLocalDateString(d) === getLocalDateString(new Date());

              return (
                <div key={i} className={`p-2 space-y-2 ${isToday ? 'bg-brand-primary/5' : 'bg-surface'}`}>
                  {dayEvs.length === 0 ? (
                    <div className="pt-8 text-center text-[10px] text-text-muted select-none">
                      No events
                    </div>
                  ) : (
                    dayEvs.map((ev) => (
                      <Link
                        key={ev.id}
                        href={ev.linkHref}
                        className={`block rounded-lg border p-2 text-xs transition-shadow hover:shadow-sm ${
                          ev.type === 'VISIT'
                            ? 'border-blue-200 bg-blue-50/70 text-blue-950'
                            : 'border-slate-200 bg-slate-50 text-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-semibold">
                          <span className={ev.type === 'VISIT' ? 'text-blue-700' : 'text-slate-600'}>
                            {new Date(ev.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span
                            className={`rounded px-1 py-0.2 text-[8px] font-bold uppercase ${
                              ev.status === TaskStatus.COMPLETED || ev.status === VisitStatus.COMPLETED
                                ? 'bg-emerald-100 text-emerald-800'
                                : ev.status === TaskStatus.BLOCKED
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-white text-slate-700'
                            }`}
                          >
                            {ev.status}
                          </span>
                        </div>
                        <div className="mt-1 font-bold text-[11px] line-clamp-1">{ev.title}</div>
                      </Link>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Day View */
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-primary mb-4">
            Schedule for {currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>

          {getDayEvents(currentDate).length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted">
              <p className="font-semibold text-slate-700">No events scheduled for this day</p>
              <p className="mt-1">Try scheduling a visit or assigning a task with a due date.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {getDayEvents(currentDate).map((ev) => (
                <div
                  key={ev.id}
                  className={`flex items-center justify-between rounded-lg border p-4 text-xs ${
                    ev.type === 'VISIT'
                      ? 'border-blue-200 bg-blue-50/30'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="min-w-20 font-mono text-xs font-bold text-slate-700">
                      {new Date(ev.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary text-sm">{ev.title}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            ev.type === 'VISIT' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {ev.type}
                        </span>
                        <span className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700">
                          {ev.status}
                        </span>
                      </div>
                      {ev.assignedTo && (
                        <p className="mt-1 text-[11px] text-text-muted">
                          Assignee: Worker #{ev.assignedTo.slice(0, 8)}
                        </p>
                      )}
                    </div>
                  </div>

                  <Link href={ev.linkHref}>
                    <Button variant="secondary" className="h-8 px-3 text-xs">
                      View Details →
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
