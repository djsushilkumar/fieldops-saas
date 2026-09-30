'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { getTaskService, getLocationService } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Task,
  TaskStatus,
  Priority,
  can,
  Permissions,
  UserRole,
  isTaskOverdue,
  TaskId,
  Location,
} from '@fieldops/types';

export default function TasksPage() {
  const { user, activeRole } = useAuth();
  const { activeOrganization } = useOrganization();
  const taskService = getTaskService();
  const locationService = getLocationService();

  const [tasks, setTasks] = useState<readonly Task[]>([]);
  const [locations, setLocations] = useState<readonly Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // View Mode: TaskOPad Kanban Board vs Standard Table
  const [viewMode, setViewMode] = useState<'KANBAN' | 'TABLE'>('KANBAN');

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Create Task Drawer / Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPriority, setCreatePriority] = useState<Priority>(Priority.MEDIUM);
  const [createDueAt, setCreateDueAt] = useState('');
  const [createLocationId, setCreateLocationId] = useState('');
  const [checklistItems, setChecklistItems] = useState<{ title: string; isRequired: boolean }[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newChecklistRequired, setNewChecklistRequired] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Blocker reason modal
  const [blockingTaskId, setBlockingTaskId] = useState<TaskId | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState('');

  const role = activeRole || UserRole.FIELD_WORKER;
  const canCreateTask = can(role, Permissions.TASK_CREATE);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const filters: Record<string, unknown> = {};
      if (selectedStatus !== 'ALL') {
        filters.status = selectedStatus as TaskStatus;
      }
      if (selectedPriority !== 'ALL') {
        filters.priority = selectedPriority as Priority;
      }
      if (searchQuery.trim().length > 0) {
        filters.search = searchQuery.trim();
      }
      if (onlyOverdue) {
        filters.isOverdue = true;
      }

      const [taskRes, locRes] = await Promise.all([
        taskService.listTasks(filters, { page: 1, pageSize: 100 }, { field: 'createdAt', order: 'desc' }),
        locationService.listLocations().catch(() => []),
      ]);

      setTasks(taskRes.items || []);
      setLocations(locRes || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load tasks.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatus, selectedPriority, searchQuery, onlyOverdue]);

  useEffect(() => {
    if (activeOrganization) {
      fetchTasks();
    }
  }, [activeOrganization, fetchTasks]);

  const handleQuickStatusChange = async (
    taskId: TaskId,
    newStatus: TaskStatus,
    expectedVersion: number,
    blockedReason?: string
  ) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              blockedReason: newStatus === TaskStatus.BLOCKED ? blockedReason : undefined,
              version: t.version + 1,
            }
          : t
      )
    );

    try {
      await taskService.transitionStatus(taskId, {
        status: newStatus,
        expectedVersion,
        blockedReason,
      });
      fetchTasks();
    } catch {
      // Direct PATCH fallback
      try {
        await fetch(`/api/v1/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, blockedReason }),
        });
        fetchTasks();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Status update failed';
        setErrorMessage(msg);
      }
    }
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklistItems((prev) => [
      ...prev,
      { title: newChecklistText.trim(), isRequired: newChecklistRequired },
    ]);
    setNewChecklistText('');
    setNewChecklistRequired(true);
  };

  const handleRemoveChecklistItem = (index: number) => {
    setChecklistItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const selectedLoc = locations.find((l) => l.id === createLocationId);

    const payload = {
      title: createTitle.trim(),
      description: createDescription.trim() || undefined,
      priority: createPriority,
      dueAt: createDueAt ? new Date(createDueAt).toISOString() : undefined,
      checklists: checklistItems.length > 0 ? checklistItems : undefined,
      locationId: createLocationId || undefined,
      locationName: selectedLoc?.name || undefined,
    };

    if (!payload.title) {
      setCreateError('Title is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await taskService.createTask(payload as any);
      setIsCreateModalOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreatePriority(Priority.MEDIUM);
      setCreateDueAt('');
      setCreateLocationId('');
      setChecklistItems([]);
      fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating task.';
      setCreateError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityBadgeClass = (priority: Priority) => {
    switch (priority) {
      case Priority.URGENT:
        return 'bg-rose-100 text-rose-800 border-rose-200 font-bold';
      case Priority.HIGH:
        return 'bg-amber-100 text-amber-800 border-amber-200 font-semibold';
      case Priority.MEDIUM:
        return 'bg-sky-100 text-sky-800 border-sky-200 font-medium';
      case Priority.LOW:
        return 'bg-slate-100 text-slate-600 border-slate-200 font-normal';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusBadgeClass = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DRAFT:
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case TaskStatus.ASSIGNED:
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case TaskStatus.ACCEPTED:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case TaskStatus.IN_PROGRESS:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case TaskStatus.BLOCKED:
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case TaskStatus.COMPLETED:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case TaskStatus.CANCELED:
        return 'bg-zinc-100 text-zinc-500 border-zinc-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Group tasks for Kanban columns
  const assignedTasks = tasks.filter(
    (t) => t.status === TaskStatus.ASSIGNED || t.status === TaskStatus.DRAFT || t.status === TaskStatus.ACCEPTED
  );
  const inProgressTasks = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS);
  const blockedTasks = tasks.filter((t) => t.status === TaskStatus.BLOCKED);
  const completedTasks = tasks.filter((t) => t.status === TaskStatus.COMPLETED);

  const renderKanbanCard = (task: Task) => {
    const overdue = isTaskOverdue(task);
    const checklists = task.checklists || [];
    const totalChecks = checklists.length;
    const completedChecks = checklists.filter((c: any) => c.isCompleted || c.completed).length;
    const progressPercent = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;

    return (
      <div
        key={task.id}
        className="group relative rounded-xl border border-border bg-surface p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3"
      >
        {/* Top Badges: Priority + Overdue */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wide ${getPriorityBadgeClass(
              task.priority
            )}`}
          >
            {task.priority}
          </span>

          <div className="flex items-center gap-1.5">
            {overdue && (
              <span className="inline-flex items-center rounded-md bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 uppercase">
                ⚠️ Overdue
              </span>
            )}
            <span className="font-mono text-[10px] text-text-muted">v{task.version}</span>
          </div>
        </div>

        {/* Title & Description */}
        <div>
          <Link
            href={`/tasks/${task.id}`}
            className="text-xs font-bold text-primary group-hover:text-brand-primary transition-colors line-clamp-2"
          >
            {task.title}
          </Link>
          {task.description && (
            <p className="mt-1 text-[11px] text-text-muted line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* Unolo Geofence Client Site Link */}
        {task.locationName && (
          <div className="flex items-center gap-1.5 text-[11px] bg-slate-50 border border-slate-100 rounded-md p-1.5">
            <span className="text-rose-500 shrink-0">📍</span>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.locationName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-primary hover:underline truncate"
              title="Open geofenced location in Google Maps"
            >
              {task.locationName}
            </a>
          </div>
        )}

        {/* TaskOPad Interactive Checklist Progress */}
        {totalChecks > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-text-muted font-medium">
              <span>Checklist</span>
              <span>
                {completedChecks}/{totalChecks} ({progressPercent}%)
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  progressPercent === 100 ? 'bg-emerald-500' : 'bg-brand-primary'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Blocker Reason if Blocked */}
        {task.status === TaskStatus.BLOCKED && task.blockedReason && (
          <div className="rounded-md bg-rose-50 border border-rose-200 p-2 text-[10px] text-rose-800 leading-snug">
            <strong>Blocker:</strong> {task.blockedReason}
          </div>
        )}

        {/* Assignee & Due Date Row */}
        <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-text-muted">
          <div className="flex items-center gap-1 truncate max-w-[130px]">
            <span>👤</span>
            <span className="truncate">{task.assignedToName || 'Field Technician'}</span>
          </div>

          {task.dueAt && (
            <div className={`text-[10px] shrink-0 ${overdue ? 'font-bold text-rose-600' : 'text-slate-500'}`}>
              Due: {new Date(task.dueAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>

        {/* Quick Lifecycle Action Buttons */}
        <div className="flex items-center justify-between gap-1.5 pt-1">
          <Link href={`/tasks/${task.id}`} className="text-[11px] text-brand-primary font-semibold hover:underline">
            Details →
          </Link>

          <div className="flex items-center gap-1">
            {task.status !== TaskStatus.IN_PROGRESS && task.status !== TaskStatus.COMPLETED && (
              <button
                onClick={() => handleQuickStatusChange(task.id, TaskStatus.IN_PROGRESS, task.version)}
                className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 hover:bg-sky-100 transition-colors"
                title="Transition to In Progress"
              >
                ▶ Start
              </button>
            )}

            {task.status === TaskStatus.IN_PROGRESS && (
              <>
                <button
                  onClick={() => {
                    setBlockingTaskId(task.id);
                    setBlockReasonInput('');
                  }}
                  className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                  title="Mark Blocked"
                >
                  ⏸ Block
                </button>
                <button
                  onClick={() => handleQuickStatusChange(task.id, TaskStatus.COMPLETED, task.version)}
                  className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                  title="Mark Completed"
                >
                  ✔ Done
                </button>
              </>
            )}

            {task.status === TaskStatus.BLOCKED && (
              <button
                onClick={() => handleQuickStatusChange(task.id, TaskStatus.IN_PROGRESS, task.version)}
                className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100 transition-colors"
                title="Resume Work"
              >
                ▶ Resume
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
              Work & Field Orders
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
            </span>
            <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              TaskOPad + Unolo Hybrid
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary">
            Work Order & Task Engine
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Kanban workflow swimlanes, geofenced client site navigation, multi-step checklists, and real-time status transitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-slate-100 p-0.5 text-xs font-medium">
            <button
              onClick={() => setViewMode('KANBAN')}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 transition-all ${
                viewMode === 'KANBAN'
                  ? 'bg-surface text-primary shadow-sm font-bold'
                  : 'text-text-muted hover:text-primary'
              }`}
            >
              <span>🗂️</span>
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 transition-all ${
                viewMode === 'TABLE'
                  ? 'bg-surface text-primary shadow-sm font-bold'
                  : 'text-text-muted hover:text-primary'
              }`}
            >
              <span>📋</span>
              <span>List</span>
            </button>
          </div>

          {canCreateTask && (
            <Button
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
              className="text-xs font-semibold"
            >
              + Create Task
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="font-semibold text-text-muted shrink-0 mr-1">Filter:</span>
          {['ALL', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`rounded-md px-3 py-1 font-medium transition-colors shrink-0 ${
                selectedStatus === st
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="priority-filter" className="font-semibold text-text-muted">
                Priority:
              </label>
              <select
                id="priority-filter"
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="rounded-md border border-input bg-surface px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="ALL">All Priorities</option>
                {Object.values(Priority).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-text-muted hover:text-foreground">
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
                className="rounded border-input text-brand-primary focus:ring-brand-primary"
              />
              <span>Only Overdue Tasks</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search work orders, sites, technicians..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded-md border border-input bg-surface px-3 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-4 rounded-md bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          {errorMessage}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="mt-8 rounded-xl border border-border bg-surface p-16 text-center text-xs text-text-muted">
          Loading operational tasks...
        </div>
      ) : viewMode === 'KANBAN' ? (
        /* ========================================================================= */
        /* TASKOPAD KANBAN BOARD VIEW                                                */
        /* ========================================================================= */
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {/* Column 1: Assigned / Backlog */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-slate-50/70 p-3 min-h-[500px]">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <h3 className="text-xs font-bold text-primary uppercase tracking-wide">Assigned Queue</h3>
              </div>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                {assignedTasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {assignedTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-[11px] text-text-muted">
                  No assigned tasks
                </div>
              ) : (
                assignedTasks.map((t) => renderKanbanCard(t))
              )}
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-amber-50/30 p-3 min-h-[500px]">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <h3 className="text-xs font-bold text-primary uppercase tracking-wide">In Progress</h3>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                {inProgressTasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {inProgressTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-[11px] text-text-muted">
                  No tasks currently in progress
                </div>
              ) : (
                inProgressTasks.map((t) => renderKanbanCard(t))
              )}
            </div>
          </div>

          {/* Column 3: Blocked */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-rose-50/30 p-3 min-h-[500px]">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <h3 className="text-xs font-bold text-primary uppercase tracking-wide">Blocked / Attention</h3>
              </div>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                {blockedTasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {blockedTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-[11px] text-text-muted">
                  No blockers reported
                </div>
              ) : (
                blockedTasks.map((t) => renderKanbanCard(t))
              )}
            </div>
          </div>

          {/* Column 4: Completed */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-emerald-50/30 p-3 min-h-[500px]">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-bold text-primary uppercase tracking-wide">Completed</h3>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                {completedTasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {completedTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-[11px] text-text-muted">
                  No completed tasks yet
                </div>
              ) : (
                completedTasks.map((t) => renderKanbanCard(t))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* STANDARD LIST / TABLE VIEW                                                */
        /* ========================================================================= */
        <div className="mt-6 rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          {tasks.length === 0 ? (
            <div className="p-12 text-center text-xs text-text-muted">
              <p className="text-sm font-semibold text-primary">No tasks found</p>
              <p className="mt-1">Try adjusting your filters or create a new task to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[750px] text-left text-xs">
                <thead className="border-b border-border bg-slate-50 text-text-muted">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Title & Work Order</th>
                    <th className="px-4 py-3 font-semibold">Client Site</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Due Date</th>
                    <th className="px-4 py-3 font-semibold">Checklist</th>
                    <th className="px-4 py-3 font-semibold">Assignee</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tasks.map((task) => {
                    const overdue = isTaskOverdue(task);
                    const checklists = task.checklists || [];
                    const totalChecks = checklists.length;
                    const completedChecks = checklists.filter((c: any) => c.isCompleted || c.completed).length;
                    const progressPercent = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;

                    return (
                      <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-primary">
                            <Link href={`/tasks/${task.id}`} className="hover:underline">
                              {task.title}
                            </Link>
                          </div>
                          {task.description && (
                            <p className="mt-0.5 line-clamp-1 text-slate-500 max-w-sm">
                              {task.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {task.locationName ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.locationName)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-primary hover:underline font-medium flex items-center gap-1"
                            >
                              <span>📍</span>
                              <span className="truncate max-w-[140px]">{task.locationName}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(
                              task.status
                            )}`}
                          >
                            {task.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-[10px] ${getPriorityBadgeClass(
                              task.priority
                            )}`}
                          >
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {task.dueAt ? (
                            <span
                              className={`font-medium ${
                                overdue ? 'font-bold text-rose-600' : 'text-slate-600'
                              }`}
                            >
                              {new Date(task.dueAt).toLocaleDateString()}{' '}
                              {overdue && <span className="text-[10px] uppercase tracking-wider">(Overdue)</span>}
                            </span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {totalChecks > 0 ? (
                            <div className="w-24">
                              <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                                <span>{completedChecks}/{totalChecks}</span>
                                <span>{progressPercent}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${progressPercent === 100 ? 'bg-emerald-500' : 'bg-brand-primary'}`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <span className="truncate max-w-[120px] block">
                            {task.assignedToName || 'Unassigned'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link href={`/tasks/${task.id}`}>
                            <Button variant="secondary" className="h-7 px-2.5 text-xs">
                              Details
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Blocker Modal */}
      {blockingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
            <h3 className="text-base font-bold text-primary">Specify Reason for Task Blocker</h3>
            <p className="mt-1 text-xs text-text-muted">
              Explain what is hindering the field technician (site closed, missing parts, safety risk).
            </p>
            <textarea
              rows={3}
              value={blockReasonInput}
              onChange={(e) => setBlockReasonInput(e.target.value)}
              placeholder="e.g. Compressor valve locked; facility manager unreachable."
              className="mt-3 w-full rounded-md border border-input bg-surface p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setBlockingTaskId(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const t = tasks.find((item) => item.id === blockingTaskId);
                  if (t) {
                    handleQuickStatusChange(
                      blockingTaskId,
                      TaskStatus.BLOCKED,
                      t.version,
                      blockReasonInput || 'Operational block reported'
                    );
                  }
                  setBlockingTaskId(null);
                }}
              >
                Mark Blocked
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-primary">Create Work Order</h2>
                <p className="text-xs text-text-muted">Define title, priority, client site geofence, and checklist items.</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="mt-4 rounded-md bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspect emergency generator fuel valve"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Operational instructions, safety notes, access codes..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              {/* Unolo Client Site Geofence selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  📍 Client Facility / Geofenced Location
                </label>
                <select
                  value={createLocationId}
                  onChange={(e) => setCreateLocationId(e.target.value)}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                >
                  <option value="">No Location Linked (Office Task)</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.address || `${loc.latitude}, ${loc.longitude}`})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value as Priority)}
                    className="w-full rounded-md border border-input bg-surface px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  >
                    {Object.values(Priority).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    value={createDueAt}
                    onChange={(e) => setCreateDueAt(e.target.value)}
                    className="w-full rounded-md border border-input bg-surface px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </div>
              </div>

              {/* Checklist Builder */}
              <div className="border-t border-border pt-3">
                <label className="block font-semibold text-slate-700 mb-2">Checklist Steps</label>
                {checklistItems.length > 0 && (
                  <ul className="mb-3 space-y-1.5">
                    {checklistItems.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between rounded bg-slate-50 px-2.5 py-1.5 border border-slate-100"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{item.title}</span>
                          {item.isRequired && (
                            <span className="rounded bg-rose-50 px-1 py-0.2 text-[9px] font-bold text-rose-700">
                              REQUIRED
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveChecklistItem(idx)}
                          className="text-slate-400 hover:text-rose-600 font-bold"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="New checklist step..."
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                    className="flex-1 rounded-md border border-input bg-surface px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                  <label className="flex items-center gap-1 font-medium text-text-muted cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={newChecklistRequired}
                      onChange={(e) => setNewChecklistRequired(e.target.checked)}
                      className="rounded border-input text-brand-primary focus:ring-brand-primary"
                    />
                    <span>Required</span>
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddChecklistItem}
                    className="h-7 px-2.5 text-xs shrink-0"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Work Order'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
