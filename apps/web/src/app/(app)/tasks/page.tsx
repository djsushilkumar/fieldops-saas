'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { getTaskService } from '@/lib/api';
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
} from '@fieldops/types';
import { createTaskSchema } from '@fieldops/validation';

export default function TasksPage() {
  const { user, activeRole } = useAuth();
  const { activeOrganization } = useOrganization();
  const taskService = getTaskService();

  const [tasks, setTasks] = useState<readonly Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  const [checklistItems, setChecklistItems] = useState<{ title: string; isRequired: boolean }[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newChecklistRequired, setNewChecklistRequired] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      const res = await taskService.listTasks(filters, { page: 1, pageSize: 50 }, { field: 'createdAt', order: 'desc' });
      setTasks(res.items || []);
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

    const payload = {
      title: createTitle.trim(),
      description: createDescription.trim() || undefined,
      priority: createPriority,
      dueAt: createDueAt ? new Date(createDueAt).toISOString() : undefined,
      checklists: checklistItems.length > 0 ? checklistItems : undefined,
    };

    const validation = createTaskSchema.safeParse(payload);
    if (!validation.success) {
      setCreateError(validation.error.issues[0].message);
      return;
    }

    setIsSubmitting(true);
    try {
      await taskService.createTask(validation.data as any);
      setIsCreateModalOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreatePriority(Priority.MEDIUM);
      setCreateDueAt('');
      setChecklistItems([]);
      fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating task.';
      setCreateError(msg);
    } finally {
      setIsSubmitting(false);
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

  const getPriorityBadgeClass = (priority: Priority) => {
    switch (priority) {
      case Priority.URGENT:
        return 'bg-rose-100 text-rose-800 font-bold';
      case Priority.HIGH:
        return 'bg-amber-100 text-amber-800 font-semibold';
      case Priority.MEDIUM:
        return 'bg-sky-100 text-sky-800 font-medium';
      case Priority.LOW:
        return 'bg-slate-100 text-slate-600 font-normal';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const statusOptions = ['ALL', ...Object.values(TaskStatus)];

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
              Work Management
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary">
            Task Management Engine
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Track operational tasks, assign field technicians, monitor checklists, and resolve blockers.
          </p>
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

      {/* Filter Bar */}
      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="font-semibold text-text-muted shrink-0 mr-1">Status:</span>
          {statusOptions.map((st) => (
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

        {/* Secondary Filters: Priority, Search, Overdue */}
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
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 rounded-md border border-input bg-surface px-3 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-primary"
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

      {/* Task List Table */}
      <div className="mt-6 rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-text-muted">
            Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            <p className="text-sm font-semibold text-primary">No tasks found</p>
            <p className="mt-1">Try adjusting your filters or create a new task to get started.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-slate-50 text-text-muted">
              <tr>
                <th className="px-6 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Due Date</th>
                <th className="px-4 py-3 font-semibold">Checklist</th>
                <th className="px-4 py-3 font-semibold">Version</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((task) => {
                const overdue = isTaskOverdue(task);
                const totalChecks = task.checklists?.length || 0;
                const completedChecks = task.checklists?.filter((c) => c.isCompleted).length || 0;

                return (
                  <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-primary">
                        <Link href={`/tasks/${task.id}`} className="hover:underline">
                          {task.title}
                        </Link>
                      </div>
                      {task.description && (
                        <p className="mt-0.5 line-clamp-1 text-slate-500 max-w-md">
                          {task.description}
                        </p>
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
                        <span className="font-mono text-[11px]">
                          {completedChecks}/{totalChecks} done
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-400 font-mono text-[11px]">
                      v{task.version}
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
        )}
      </div>

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-primary">Create New Task</h2>
                <p className="text-xs text-text-muted">Define title, priority, schedule, and checklist items.</p>
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
                  rows={3}
                  placeholder="Operational instructions, safety notes, access codes..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
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
                <label className="block font-semibold text-slate-700 mb-2">Checklist Items</label>
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
                  {isSubmitting ? 'Creating...' : 'Create Task'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
