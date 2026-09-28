# FieldOps — User Stories & Acceptance Criteria

---

## 1. Overview & Quality Standards

Every user story in this document follows the standard agile structure:
> **As a** `[Role]`,  
> **I want to** `[Action / Capability]`,  
> **So that** `[Business Value / Operational Outcome]`.

Acceptance criteria must be **specific**, **testable**, **observable**, and **unambiguous**.

---

## 2. Operations Module: Tasks

### Story US-TSK-01: Create and Dispatch a Structured Task
- **Role**: Operations Manager / Supervisor
- **Story**: As a manager, I want to create a task with structured checklists and assign it to a team or individual field worker, so that the field technician has explicit instructions for their shift.
- **Acceptance Criteria**:
  1. The task creation form enforces non-empty `Title`, valid `Priority` (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), and `Due Date/Time`.
  2. The creator can add 1 to 50 checklist items and toggle whether each item is `mandatory`.
  3. The creator can attach up to 5 reference files (PDF, PNG, JPG; max 10MB each).
  4. Upon dispatch, the task transitions from `DRAFT` to `ASSIGNED`.
  5. The assigned field worker receives an immediate push notification if network is available.
  6. The created task appears in the Web Dispatcher Task Board within 500ms of server commit.

### Story US-TSK-02: Acknowledge and Start an Assigned Task
- **Role**: Field Worker
- **Story**: As a field worker, I want to acknowledge and start an assigned task on my mobile app, so that the back-office knows work has commenced.
- **Acceptance Criteria**:
  1. When viewing an assigned task, the worker is presented with primary actions: "Accept" or "Start Task".
  2. Tapping "Start Task" transitions status directly to `IN_PROGRESS` and records local UTC start timestamp.
  3. The mobile task detail displays an active timer indicating elapsed execution duration.
  4. The status update is committed to the local SQLite database in under 50ms and placed in the mutation sync queue.
  5. On the Web Console, the task status pill switches to `IN_PROGRESS` with blue accent.

### Story US-TSK-03: Complete Task with Mandatory Checklist & Proof
- **Role**: Field Worker
- **Story**: As a field worker, I want to complete my task after fulfilling all checklist items and submitting required proof, so that my work is credited and ready for review.
- **Acceptance Criteria**:
  1. The "Complete Task" button remains disabled with a counter (e.g., "3 of 5 checklist items completed") until all items flagged as `mandatory` are checked.
  2. If the task requires photo proof, tapping "Complete Task" without an attached photo opens an inline warning dialog prompting the camera.
  3. Upon fulfilling all preconditions, tapping "Complete Task" transitions status to `COMPLETED` and records completion timestamp.
  4. The completed task is archived from the active mobile task list and moved to the "Completed Today" section.

### Story US-TSK-04: Report a Blocked Task with Reason
- **Role**: Field Worker
- **Story**: As a field worker, I want to mark a task as blocked when I encounter an obstacle, so that my supervisor is alerted and can assist.
- **Acceptance Criteria**:
  1. From an `IN_PROGRESS` task, the worker can tap "Flag as Blocked".
  2. The app requires a non-empty text reason (minimum 10 characters) explaining the blocker (e.g., "Customer not home, gate locked").
  3. Status transitions to `BLOCKED`.
  4. An alert banner appears on the Supervisor and Manager Web Dashboards within 5 seconds of sync.

---

## 3. Operations Module: Field Visits & Geofencing

### Story US-VIS-01: Schedule a Customer Field Visit
- **Role**: Operations Manager / Dispatcher
- **Story**: As a dispatcher, I want to schedule a visit to a customer location with a defined time window, so that the customer and technician have clear expectations.
- **Acceptance Criteria**:
  1. A visit requires a valid customer `Location` with latitude, longitude, and allowed geofence radius.
  2. The dispatcher specifies scheduled start and end timestamps.
  3. The visit can optionally link to an existing `Task`.
  4. The visit appears on the Dispatch Calendar in the assigned technician's timeline lane.

### Story US-VIS-02: Navigate to Visit Location via Native Maps
- **Role**: Field Worker
- **Story**: As a field worker, I want to tap "Navigate" on a scheduled visit to launch my phone's mapping app, so that I can get turn-by-turn driving directions.
- **Acceptance Criteria**:
  1. Tapping "Navigate" opens an OS chooser or launches default navigation (Google Maps, Apple Maps, or Waze).
  2. The destination coordinates and address are correctly passed in the geo URI (`geo:lat,lng?q=address`).
  3. The visit status automatically updates to `EN_ROUTE`.

### Story US-VIS-03: Geofenced Check-In at Customer Site (Valid)
- **Role**: Field Worker
- **Story**: As a field worker, I want to check in upon arrival at the customer site, so that my on-time presence is verified.
- **Acceptance Criteria**:
  1. Tapping "Check In" triggers hardware GPS sampling.
  2. If GPS accuracy is $> 50$ meters, app displays a non-blocking 10-second satellite acquisition countdown.
  3. When distance to the registered site coordinate is $\le \text{allowed\_radius\_meters}$ (e.g. 100m):
     - Visit status updates to `CHECKED_IN`.
     - `check_in_result` is set to `VALID`.
     - Check-in timestamp and coordinates are locked.
     - A green success banner confirms: "Checked in at [Site Name]".

### Story US-VIS-04: Geofenced Check-In Outside Allowed Radius (Exception)
- **Role**: Field Worker & Supervisor
- **Story**: As a field worker, I want to be able to check in even if I am outside the geofence, so that my work is not blocked by parking distances or inaccurate site boundaries.
- **Acceptance Criteria**:
  1. When distance to the registered site coordinate is $> \text{allowed\_radius\_meters}$:
     - A warning modal displays: "You are [X] meters from the registered location."
     - The worker is prompted to provide an optional note explaining why they are outside the radius.
     - Check-in is permitted to proceed; status becomes `CHECKED_IN` and `check_in_result` is set to `LOCATION_EXCEPTION`.
  2. On the Web Manager Dashboard and Live Map, the visit pin highlights in amber with an exception tag.
  3. A Supervisor or Manager can click "Approve Exception", which updates `check_in_result` to `OVERRIDDEN` and records an immutable audit log entry.

### Story US-VIS-05: Visit Check-Out and Duration Tracking
- **Role**: Field Worker
- **Story**: As a field worker, I want to check out when departing the customer location, so that the total time on site is accurately recorded.
- **Acceptance Criteria**:
  1. Tapping "Check Out" captures departure GPS coordinates and timestamp.
  2. Total duration on site ($\text{check\_out\_time} - \text{check\_in\_time}$) is calculated and stored.
  3. Visit status transitions to `COMPLETED`.

---

## 4. Workforce Module: Attendance

### Story US-ATT-01: Shift Clock-In with Location Verification
- **Role**: Field Worker
- **Story**: As a field worker, I want to clock in at the beginning of my shift using my mobile phone, so that my hours and starting location are officially logged.
- **Acceptance Criteria**:
  1. Tapping "Clock In" on the Home Screen captures current UTC timestamp and high-accuracy GPS coordinates.
  2. The worker's state transitions to `CLOCKED_IN`.
  3. The mobile home screen displays an active duty timer.
  4. On the Web Attendance Board, the worker's status pill reflects "Clocked In" with clock-in time and coordinate badge.

### Story US-ATT-02: Shift Clock-Out
- **Role**: Field Worker
- **Story**: As a field worker, I want to clock out at the end of my shift, so that my duty day is formally concluded.
- **Acceptance Criteria**:
  1. Tapping "Clock Out" displays a confirmation modal with summary of today's hours.
  2. If the worker currently has a task in `IN_PROGRESS` or a visit in `CHECKED_IN`, the modal warns: "You have active tasks in progress. Are you sure you want to clock out?".
  3. Upon confirmation, departure GPS and timestamp are recorded; state becomes `CLOCKED_OUT`.

### Story US-ATT-03: Manager Manual Attendance Adjustment (Audited)
- **Role**: Operations Manager / Admin
- **Story**: As an operations manager, I want to correct an employee's missed clock-out time, so that company attendance records remain accurate.
- **Acceptance Criteria**:
  1. Manager opens an attendance record and clicks "Adjust Attendance".
  2. Manager inputs revised clock-out time and a mandatory justification reason (minimum 10 characters).
  3. The record is flagged with `is_manually_adjusted = true`.
  4. An audit log entry is written containing: `manager_id`, `original_time`, `new_time`, `reason`, and `timestamp`.

---

## 5. Proof of Work & Media Verification

### Story US-POW-01: Capture Photo Proof of Work with Metadata
- **Role**: Field Worker
- **Story**: As a field worker, I want to take a photo of completed work within the app, so that there is indisputable visual proof of quality.
- **Acceptance Criteria**:
  1. Camera launches within the FieldOps app; photo capture captures full sensor resolution.
  2. Photo is compressed locally to a target size of $\le 1.5\text{MB}$ without losing legible detail.
  3. EXIF metadata is extracted (capture timestamp, GPS coordinates, device model).
  4. A visible, unobtrusive semi-transparent watermark is stamped in the bottom corner showing: Worker Name, UTC Date/Time, and Lat/Long.
  5. Photo thumbnail renders in the task attachment tray within 1 second.

### Story US-POW-02: Capture Customer Signature on Glass
- **Role**: Field Worker & Customer
- **Story**: As a field worker, I want the client to sign on my phone screen upon job completion, so that authorization is verified.
- **Acceptance Criteria**:
  1. Signature pad opens full screen in landscape or large portrait modal.
  2. Captures smooth vector signature strokes with low latency ($< 16\text{ms}$ touch response).
  3. Form collects signer's printed full name and relationship/title (e.g., "Facility Manager").
  4. "Clear" and "Accept Signature" buttons are accessible.
  5. Saved signature is stored as an immutable proof record linked to the task/visit.

---

## 6. Offline-First Resilience

### Story US-OFF-01: Complete Work While Fully Disconnected
- **Role**: Field Worker
- **Story**: As a field worker operating in a basement with zero cellular signal, I want to execute tasks, check checklists, and snap photos without app errors, so that my work proceeds uninterrupted.
- **Acceptance Criteria**:
  1. When device is in Airplane Mode, all read operations (viewing assigned tasks, site notes, past visits) render instantly from local cache.
  2. Check-in, checklist completion, and photo capture succeed with optimistic UI confirmation.
  3. A persistent top bar indicator states: "Offline • [N] changes waiting to sync".
  4. App does not freeze, crash, or present blocking network error dialogs.

### Story US-OFF-02: Automatic Background Sync on Reconnection
- **Role**: Field Worker & System
- **Story**: As a field worker, I want my queued offline actions to sync automatically when I return to cell coverage, so that I don't have to manually resend work.
- **Acceptance Criteria**:
  1. Upon network restoration, background sync worker detects connectivity within 5 seconds.
  2. Top bar changes to "Syncing...".
  3. Mutations are sent to the server in chronological order with unique idempotency keys.
  4. Upon server acknowledgment, mutations are dequeued; status bar updates to "All Changes Synced" (green checkmark).
  5. If the network drops mid-sync, remaining items remain queued without duplication or data loss.

---

## 7. Web Management & Dashboard

### Story US-DSH-01: Manager Real-Time Operational Dashboard
- **Role**: Operations Manager
- **Story**: As an operations manager, I want to view a real-time dashboard of today's operational metrics, so that I can immediately identify late visits, unassigned tasks, and attendance shortfalls.
- **Acceptance Criteria**:
  1. Dashboard displays 5 primary metric cards: Tasks Today (Completed / In Progress / Pending / Overdue), Active Clocked-In Workers, Visits Today, and Location Exceptions.
  2. Metric cards update automatically or via refresh without full page reload.
  3. Clicking any metric card filters the respective list view (e.g. clicking "Overdue" navigates to Tasks filtered by `status=OVERDUE`).
  4. An "Exceptions Requiring Attention" feed lists all unassigned urgent tasks, active blockers, and geofence exceptions in real time.

### Story US-MAP-01: Live Operational Map Dispatch
- **Role**: Dispatcher / Supervisor
- **Story**: As a dispatcher, I want to view all team members and scheduled visit pins on an interactive map, so that I can coordinate dispatch geographically.
- **Acceptance Criteria**:
  1. Map renders all customer locations for the selected date.
  2. Pins are color-coded: Scheduled (Gray), In Progress (Blue), Completed (Green), Exception (Amber).
  3. Clicking a technician pin displays their name, phone number, last verified check-in, and current active task.
  4. Map can be filtered by Team and status.

---

## 8. Security & Multi-Tenancy

### Story US-SEC-01: Multi-Tenant Data Isolation
- **Role**: System Architect / Security Auditor
- **Story**: As an enterprise customer, I want mathematical guarantee that another company using FieldOps cannot read, modify, or leak my organization's operational data.
- **Acceptance Criteria**:
  1. Every database query enforces tenant isolation via `WHERE organization_id = :current_tenant_id` or database Row-Level Security (RLS).
  2. An API request attempting to fetch `/api/v1/tasks/{task_id}` belonging to Organization B while authenticated as Organization A returns HTTP 404 Not Found (or 403 Forbidden) and writes a security alert to the system log.
  3. S3/Cloud storage object paths are namespaced by tenant: `storage/{organization_id}/proofs/...` with pre-signed URL authorization.
  4. Automated integration tests verify that cross-tenant read/write exploits are 100% blocked.
