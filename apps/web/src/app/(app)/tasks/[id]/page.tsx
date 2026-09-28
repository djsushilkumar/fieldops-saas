'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getTaskService, getTeamService } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Task,
  TaskId,
  TaskStatus,
  Priority,
  TaskChecklistItem,
  TaskComment,
  TaskActivity,
  TaskAttachment,
  can,
  Permissions,
  UserRole,
  isValidTaskTransition,
  isTaskOverdue,
  UUID,
} from '@fieldops/types';

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = (params?.id as string) as TaskId;

  const { user, activeRole } = useAuth();
  const taskService = getTaskService();

  const [task, setTask] = useState<Task | null>(null);
  const [checklists, setChecklists] = useState<readonly TaskChecklistItem[]>([]);
  const [comments, setComments] = useState<readonly TaskComment[]>([]);
  const [activities, setActivities] = useState<readonly TaskActivity[]>([]);
  const [attachments, setAttachments] = useState<readonly TaskAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Status Action Modals
  const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newChecklistRequired, setNewChecklistRequired] = useState(true);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const role = activeRole || UserRole.FIELD_WORKER;
  const canAssign = can(role, Permissions.TASK_ASSIGN);
  const canDeleteTask = can(role, Permissions.TASK_DELETE);

  const loadTaskData = useCallback(async () => {
    if (!taskId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [taskRes, checkRes, commRes, actRes, attRes] = await Promise.all([
        taskService.getTask(taskId),
        taskService.listChecklists(taskId),
        taskService.listComments(taskId),
        taskService.listActivities(taskId),
        taskService.listAttachments(taskId),
      ]);
      setTask(taskRes);
      setChecklists(checkRes || []);
      setComments(commRes || []);
      setActivities(actRes || []);
      setAttachments(attRes || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load task details.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData]);

  const handleStatusTransition = async (
    targetStatus: TaskStatus,
    extraOptions?: { blockedReason?: string; reopenReason?: string }
  ) => {
    if (!task) return;

    const incompleteRequired = checklists.filter((c) => c.isRequired && !c.isCompleted).length;
    const transitionCheck = isValidTaskTransition(task.status, targetStatus, role, {
      incompleteRequiredChecklists: incompleteRequired,
      blockedReason: extraOptions?.blockedReason,
      reopenReason: extraOptions?.reopenReason,
      hasAssignee: !!task.assignedTo || !!task.assignedTeam,
    });

    if (!transitionCheck.valid) {
      setErrorMessage(transitionCheck.reason || 'Invalid status transition.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updated = await taskService.transitionStatus(task.id, {
        status: targetStatus,
        blockedReason: extraOptions?.blockedReason,
        reopenReason: extraOptions?.reopenReason,
        expectedVersion: task.version,
      });
      setTask(updated);
      setActionSuccess(`Status transitioned to ${targetStatus}`);
      setIsBlockedModalOpen(false);
      setIsReopenModalOpen(false);
      setBlockedReason('');
      setReopenReason('');
      loadTaskData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating task status.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleChecklist = async (item: TaskChecklistItem) => {
    if (!task) return;
    try {
      const updatedItem = await taskService.toggleChecklistItem(task.id, item.id, !item.isCompleted);
      setChecklists((prev) =>
        prev.map((c) => (c.id === updatedItem.id ? updatedItem : c))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error toggling checklist item.';
      setErrorMessage(msg);
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newChecklistText.trim()) return;
    try {
      const newItem = await taskService.addChecklistItem(task.id, {
        title: newChecklistText.trim(),
        isRequired: newChecklistRequired,
      });
      setChecklists((prev) => [...prev, newItem]);
      setNewChecklistText('');
      setNewChecklistRequired(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error adding checklist item.';
      setErrorMessage(msg);
    }
  };

  const handleDeleteChecklistItem = async (itemId: UUID) => {
    if (!task) return;
    try {
      await taskService.deleteChecklistItem(task.id, itemId);
      setChecklists((prev) => prev.filter((c) => c.id !== itemId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting checklist item.';
      setErrorMessage(msg);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newCommentText.trim()) return;
    try {
      const comment = await taskService.addComment(task.id, { content: newCommentText.trim() });
      setComments((prev) => [...prev, comment]);
      setNewCommentText('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error posting comment.';
      setErrorMessage(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-8 text-center text-xs text-text-muted">
        Loading task details...
      </div>
    );
  }

  if (!task) {
    return (
      <div className="mx-auto max-w-5xl p-8 text-center text-xs">
        <p className="text-sm font-bold text-rose-600">Task Not Found</p>
        <p className="mt-1 text-text-muted">The requested task does not exist or access was denied.</p>
        <Link href="/tasks" className="mt-4 inline-block">
          <Button variant="secondary" className="text-xs">← Back to Tasks</Button>
        </Link>
      </div>
    );
  }

  const overdue = isTaskOverdue(task);
  const incompleteRequired = checklists.filter((c) => c.isRequired && !c.isCompleted).length;
  const totalChecks = checklists.length;
  const completedChecks = checklists.filter((c) => c.isCompleted).length;
  const checklistProgress = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl p-8">
      {/* Back button & Breadcrumb */}
      <div className="mb-4 flex items-center justify-between text-xs">
        <Link href="/tasks" className="font-semibold text-brand-primary hover:underline flex items-center gap-1">
          ← Back to Tasks
        </Link>
        <span className="font-mono text-slate-400">ID: {task.id}</span>
      </div>

      {/* Task Header */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                v{task.version}
              </span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {task.priority} PRIORITY
              </span>
              {overdue && (
                <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  OVERDUE
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-primary">{task.title}</h1>
            <p className="mt-1 text-xs text-text-muted">
              Created {new Date(task.createdAt).toLocaleString()} · Updated{' '}
              {new Date(task.updatedAt).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-slate-50 px-3 py-1 text-xs font-bold text-primary">
              Status: {task.status}
            </span>
          </div>
        </div>

        {task.description && (
          <div className="mt-4 border-t border-border pt-4 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
            {task.description}
          </div>
        )}

        {task.blockedReason && task.status === TaskStatus.BLOCKED && (
          <div className="mt-4 rounded-md bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
            <strong>Blocked Reason:</strong> {task.blockedReason}
          </div>
        )}

        {/* Status Transition Action Buttons */}
        <div className="mt-6 border-t border-border pt-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Available Lifecycle Actions
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {task.status === TaskStatus.DRAFT && (
              <Button
                variant="primary"
                onClick={() => handleStatusTransition(TaskStatus.ASSIGNED)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Mark Assigned
              </Button>
            )}

            {task.status === TaskStatus.ASSIGNED && (
              <>
                <Button
                  variant="primary"
                  onClick={() => handleStatusTransition(TaskStatus.ACCEPTED)}
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  Accept Task
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleStatusTransition(TaskStatus.IN_PROGRESS)}
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  Start Work (In Progress)
                </Button>
              </>
            )}

            {task.status === TaskStatus.ACCEPTED && (
              <Button
                variant="primary"
                onClick={() => handleStatusTransition(TaskStatus.IN_PROGRESS)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Start Work (In Progress)
              </Button>
            )}

            {task.status === TaskStatus.IN_PROGRESS && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setIsBlockedModalOpen(true)}
                  disabled={isSubmitting}
                  className="text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  Mark Blocked...
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleStatusTransition(TaskStatus.COMPLETED)}
                  disabled={isSubmitting || incompleteRequired > 0}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  title={
                    incompleteRequired > 0
                      ? `${incompleteRequired} required checklist item(s) must be completed`
                      : 'Complete Task'
                  }
                >
                  Complete Task {incompleteRequired > 0 && `(${incompleteRequired} req. left)`}
                </Button>
              </>
            )}

            {task.status === TaskStatus.BLOCKED && (
              <>
                <Button
                  variant="primary"
                  onClick={() => handleStatusTransition(TaskStatus.IN_PROGRESS)}
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  Resume Work (In Progress)
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleStatusTransition(TaskStatus.COMPLETED)}
                  disabled={isSubmitting || incompleteRequired > 0}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Complete Task
                </Button>
              </>
            )}

            {task.status === TaskStatus.COMPLETED && role !== UserRole.FIELD_WORKER && (
              <Button
                variant="secondary"
                onClick={() => setIsReopenModalOpen(true)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Reopen Task...
              </Button>
            )}

            {task.status !== TaskStatus.COMPLETED &&
              task.status !== TaskStatus.CANCELED &&
              role !== UserRole.FIELD_WORKER && (
                <Button
                  variant="secondary"
                  onClick={() => handleStatusTransition(TaskStatus.CANCELED)}
                  disabled={isSubmitting}
                  className="text-xs text-zinc-600 hover:text-rose-600"
                >
                  Cancel Task
                </Button>
              )}
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="mt-4 rounded-md bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          {errorMessage}
        </div>
      )}
      {actionSuccess && (
        <div className="mt-4 rounded-md bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
          {actionSuccess}
        </div>
      )}

      {/* Grid: Checklists & Comments */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Checklists Panel */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h2 className="text-sm font-bold text-primary">Required Checklists</h2>
              <p className="text-[11px] text-text-muted">
                {completedChecks} of {totalChecks} done ({checklistProgress}%)
              </p>
            </div>
            {incompleteRequired > 0 && (
              <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                {incompleteRequired} Required Remaining
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                incompleteRequired === 0 ? 'bg-emerald-500' : 'bg-brand-primary'
              }`}
              style={{ width: `${checklistProgress}%` }}
            />
          </div>

          {/* Checklist Item List */}
          <ul className="mt-4 space-y-2 text-xs">
            {checklists.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-2.5"
              >
                <label className="flex items-center gap-2 cursor-pointer flex-1 mr-2">
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    onChange={() => handleToggleChecklist(item)}
                    className="h-4 w-4 rounded border-input text-brand-primary focus:ring-brand-primary"
                  />
                  <span className={item.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'}>
                    {item.title}
                  </span>
                  {item.isRequired && (
                    <span className="rounded bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">
                      REQ
                    </span>
                  )}
                </label>
                <button
                  onClick={() => handleDeleteChecklistItem(item.id)}
                  className="text-slate-400 hover:text-rose-600 text-xs font-bold"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {/* Add Checklist Form */}
          <form onSubmit={handleAddChecklistItem} className="mt-4 flex items-center gap-2 pt-3 border-t border-border text-xs">
            <input
              type="text"
              placeholder="Add verification step..."
              value={newChecklistText}
              onChange={(e) => setNewChecklistText(e.target.value)}
              className="flex-1 rounded-md border border-input bg-surface px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <label className="flex items-center gap-1 cursor-pointer text-[11px] text-text-muted shrink-0">
              <input
                type="checkbox"
                checked={newChecklistRequired}
                onChange={(e) => setNewChecklistRequired(e.target.checked)}
                className="rounded border-input text-brand-primary"
              />
              <span>Req</span>
            </label>
            <Button type="submit" variant="secondary" className="h-7 px-2.5 text-xs shrink-0">
              Add
            </Button>
          </form>
        </div>

        {/* Comments Panel */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="pb-3 border-b border-border">
            <h2 className="text-sm font-bold text-primary">Notes & Discussion</h2>
            <p className="text-[11px] text-text-muted">Direct operational comments from field and office staff.</p>
          </div>

          <div className="mt-3 max-h-64 overflow-y-auto space-y-2 text-xs">
            {comments.length === 0 ? (
              <p className="text-slate-400 text-center py-6">No comments recorded yet.</p>
            ) : (
              comments.map((comm) => (
                <div key={comm.id} className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                  <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                    <span className="font-semibold text-slate-700">{comm.author?.fullName || 'Colleague'}</span>
                    <span>{new Date(comm.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-800">{comm.content}</p>
                </div>
              ))
            )}
          </div>

          {/* Add Comment Form */}
          <form onSubmit={handleAddComment} className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-xs">
            <input
              type="text"
              placeholder="Post a note or update..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              className="flex-1 rounded-md border border-input bg-surface px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <Button type="submit" variant="primary" className="h-7 px-3 text-xs shrink-0">
              Send
            </Button>
          </form>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="pb-3 border-b border-border">
          <h2 className="text-sm font-bold text-primary">Activity History & Audit Trail</h2>
          <p className="text-[11px] text-text-muted">Immutable log of state changes, assignments, and checklist events.</p>
        </div>

        <div className="mt-4 space-y-2 text-xs">
          {activities.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No activity history recorded yet.</p>
          ) : (
            activities.map((act) => (
              <div key={act.id} className="flex items-start gap-3 py-1.5 border-b border-slate-100 last:border-0">
                <span className="h-2 w-2 rounded-full bg-brand-primary mt-1.5 shrink-0" />
                <div className="flex-1">
                  <span className="font-semibold text-slate-800">{act.action}</span>
                  <p className="text-[11px] text-text-muted">
                    by {act.actor?.fullName || act.actorId} at {new Date(act.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Blocked Reason Modal */}
      {isBlockedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
            <h3 className="text-base font-bold text-primary">Provide Blocker Reason</h3>
            <p className="mt-1 text-xs text-text-muted">
              Explain why this task cannot proceed (missing parts, site locked, hazards, etc.).
            </p>
            <textarea
              rows={3}
              value={blockedReason}
              onChange={(e) => setBlockedReason(e.target.value)}
              placeholder="e.g. Electrical shutoff valve locked with padlock; site contact unreachable."
              className="mt-3 w-full rounded-md border border-input bg-surface p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsBlockedModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => handleStatusTransition(TaskStatus.BLOCKED, { blockedReason })}
                disabled={!blockedReason.trim() || isSubmitting}
              >
                Mark Blocked
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Reason Modal */}
      {isReopenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
            <h3 className="text-base font-bold text-primary">Reopen Completed Task</h3>
            <p className="mt-1 text-xs text-text-muted">
              Enter reason for reopening (e.g. quality inspection failed, rework required).
            </p>
            <textarea
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. Leak still detected during pressure testing; rework needed."
              className="mt-3 w-full rounded-md border border-input bg-surface p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsReopenModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => handleStatusTransition(TaskStatus.IN_PROGRESS, { reopenReason })}
                disabled={!reopenReason.trim() || isSubmitting}
              >
                Reopen Task
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
