# Task Events & Notification Hooks

## 1. Overview

Task operations trigger domain event envelopes to drive user-facing activity logs, audit records, and downstream notification hooks (e.g. push notifications and webhook integrations in future phases).

---

## 2. Event Taxonomy

| Event Name | Trigger Condition | Payloads & Metadata |
| :--- | :--- | :--- |
| `task.created` | Task record created in `DRAFT` or `ASSIGNED` | `{ taskId, title, priority, createdBy, assignedTo }` |
| `task.assigned` | Dispatcher assigns or reassigns task | `{ taskId, assigneeId, previousAssigneeId, assignedTeam }` |
| `task.accepted` | Field technician acknowledges assignment | `{ taskId, assigneeId, acceptedAt }` |
| `task.started` | Status transitions to `IN_PROGRESS` | `{ taskId, startedAt, assigneeId }` |
| `task.blocked` | Work obstructed on-site | `{ taskId, blockedReason, blockedBy }` |
| `task.resumed` | Status transitions from `BLOCKED` to `IN_PROGRESS` | `{ taskId, resumedBy }` |
| `task.completed` | Verification complete; 100% required checklists done | `{ taskId, completedBy, completedAt, totalChecklists }` |
| `task.reopened` | Supervisor or Admin reopens completed task | `{ taskId, reopenedBy, reopenReason }` |
| `task.canceled` | Task canceled by authorized authority | `{ taskId, canceledBy, cancelReason }` |
| `task.checklist.toggled` | Checklist item toggled | `{ taskId, itemId, isCompleted, userId }` |
| `task.comment.created` | New note/comment appended | `{ taskId, commentId, authorId }` |

---

## 3. Storage & Audit Delivery

1. **User-Facing Timeline**: All events are written synchronously to `task_activities` (append-only table protected against tampering by trigger).
2. **Compliance Audit Trail**: Security-sensitive operations (reopening, cancellation, reassignment) are simultaneously written to `audit_logs`.
3. **Notification Gateway Ready**: Phase 04 delivers event emission interfaces ready for webhook and push notification dispatchers in Phase 07.
