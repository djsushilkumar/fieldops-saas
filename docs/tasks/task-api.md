# Task Management API Contract

## 1. Overview

The Task Management Engine exposes RESTful endpoints with consistent JSON envelopes, standard pagination, and structured error responses.

---

## 2. Endpoints Summary

### 2.1 Tasks
- `GET /api/v1/tasks`: List tasks with filtering (`status`, `priority`, `assignedTo`, `assignedTeam`, `isOverdue`, `search`), pagination (`page`, `pageSize`, `cursor`), and sorting (`field`, `order`).
- `POST /api/v1/tasks`: Create a new task.
- `GET /api/v1/tasks/:id`: Retrieve single task by ID with checklists and assignee details.
- `PATCH /api/v1/tasks/:id`: Update task title, description, priority, or schedule. Requires `version` parameter for optimistic concurrency control.
- `POST /api/v1/tasks/:id/assign`: Assign or reassign task to a user or team.
- `POST /api/v1/tasks/:id/transition`: Transition lifecycle status. Body: `{ status, blockedReason?, reopenReason?, expectedVersion? }`.

### 2.2 Checklists
- `GET /api/v1/tasks/:id/checklists`: List verification items for a task.
- `POST /api/v1/tasks/:id/checklists`: Add a checklist item. Body: `{ title, isRequired }`.
- `PATCH /api/v1/tasks/:id/checklists/:itemId`: Toggle completion status. Body: `{ isCompleted }`.
- `DELETE /api/v1/tasks/:id/checklists/:itemId`: Delete checklist item.

### 2.3 Attachments & Comments
- `GET /api/v1/tasks/:id/attachments`: List attachment metadata.
- `POST /api/v1/tasks/:id/attachments`: Register attachment metadata after file upload.
- `GET /api/v1/tasks/:id/comments`: List chronological notes.
- `POST /api/v1/tasks/:id/comments`: Post a note/comment.
- `GET /api/v1/tasks/:id/activities`: List immutable chronological activity entries.

### 2.4 Offline Synchronization Gateway
- `POST /api/v1/sync/mutations`: Batch apply offline mutations with deduplication. Body: `{ mutations: [...] }`.

---

## 3. Standard Response Envelopes

### Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }
}
```

### Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "TASK_CHECKLIST_INCOMPLETE",
    "message": "Cannot complete task with 2 unfinished required checklist items.",
    "request_id": "req_1727500000_abc123",
    "details": {
      "incomplete_required_count": 2
    }
  }
}
```
