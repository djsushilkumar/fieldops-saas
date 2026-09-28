# FieldOps — Open Decisions & Consistency Audit

---

## 1. Document Purpose

This document serves as the formal register for architectural, UX, and product governance decisions, ensuring that no contradictory assumptions slip into future engineering phases.

---

## 2. Consistency Audit Summary

A rigorous cross-document audit was performed across all Phase 01 deliverables:
- `docs/product/PRD.md`
- `docs/product/vision.md`
- `docs/product/scope.md`
- `docs/product/personas.md`
- `docs/product/roles.md`
- `docs/product/user-flows.md`
- `docs/product/user-stories.md`
- `docs/security/security-principles.md`
- `docs/architecture/phase-01-architecture-principles.md`

### Audit Outcome: **Zero Unresolved Contradictions**
All role scopes, data boundaries, offline protocols, and state transitions are aligned across web, mobile, and security specifications.

---

## 3. Product & Architectural Decisions Formally Resolved

### Decision OPD-01: Field Worker Task Visibility Scope
- **Problem**: Should field workers be permitted to see all tasks assigned to their entire team, or strictly tasks assigned directly to them?
- **Analysis**:
  - *Team-Wide Visibility*: Allows workers to see peer tasks and pick up unassigned jobs, but introduces cognitive overload on small mobile screens, increases local mobile database sync footprint, and causes privacy concerns among subcontracted technicians.
  - *Assigned-Only Visibility*: Keeps mobile UI clean, minimizes local sync payload, and preserves worker confidentiality.
- **Formal Resolution**: **Strictly Assigned-Only for V1**. A Field Worker can only query and view tasks and visits where `assignee_id = current_user_id`. (Future phases may introduce a supervisor-approved "Open Shift Pool").
- **Consistency Status**: Aligned across `roles.md`, `PRD.md`, and `user-stories.md`.

---

### Decision OPD-02: Geofence Check-In Exception Policy (Hard Block vs. Soft Exception)
- **Problem**: When a field technician checks in outside the registered site radius (e.g. 250m away due to remote parking or inaccurate pin coordinates), should the app block the check-in or allow it with an exception flag?
- **Analysis**:
  - *Hard Block*: Guarantees zero out-of-bounds check-ins, but causes catastrophic operational failures when site coordinates are inaccurate or technicians must park down the road. Field work would halt until an office admin updates the coordinate.
  - *Soft Exception*: Allows the technician to proceed with their job while creating an observable, flagged `LOCATION_EXCEPTION` on the Manager Dashboard for supervisor review and audit log tracking.
- **Formal Resolution**: **Soft Exception with Mandatory Flagging**. Check-in is permitted, status is set to `LOCATION_EXCEPTION`, the worker is notified, and supervisors must review/override the exception.
- **Consistency Status**: Aligned across `PRD.md`, `user-flows.md`, and `user-stories.md`.

---

### Decision OPD-03: Proof-of-Work Photo Source (In-App Camera vs. Device Gallery)
- **Problem**: Should workers be permitted to upload photos from their phone photo gallery, or strictly capture new photos via the in-app camera?
- **Analysis**:
  - *Gallery Uploads*: Convenient if photos were taken earlier, but highly susceptible to fraud (uploading stock photos, old jobs, or downloaded pictures).
  - *In-App Camera Only*: Guarantees real-time physical capture with verifiable sensor metadata (EXIF, GPS, live timestamp) and tamper prevention.
- **Formal Resolution**: **In-App Camera Capture Required by Default**. Mobile clients enforce live camera capture for proof of work. Gallery access is disabled unless an organization admin explicitly enables a "Permit Gallery Uploads" organization policy for specific edge cases.
- **Consistency Status**: Aligned across `PRD.md` and `user-stories.md`.

---

### Decision OPD-04: Offline Conflict Resolution for Canceled Tasks
- **Problem**: If an office dispatcher cancels a task while a field technician is offline, and the technician completes the task and submits photos offline, what happens upon reconnection?
- **Analysis**:
  - *Discard Worker Data*: Server cancellation wins, worker photos deleted. This causes extreme worker frustration, potential wage disputes, and loss of evidence.
  - *Preserve Worker Proof with Canceled State*: Server cancellation status is preserved, but all uploaded photos, signatures, and notes are committed to the database as audited attachments to the canceled task.
- **Formal Resolution**: **Server Status Authoritative + Preserved Immutable Proof**. The task status remains `CANCELED`, but worker-generated proof records are permanently preserved and visible to supervisors in the audit trail.
- **Consistency Status**: Aligned across `PRD.md` and `phase-01-architecture-principles.md`.

---

## 4. Open Non-Blocking Decisions for Future Phases (Phase 02 / Phase 03)

The following items are noted for Phase 02/03 technical planning and do not block Phase 01 completion:

1. **Mapping Tile Provider Selection**: Evaluate Mapbox GL vs. MapLibre GL vs. Leaflet for Web live map to balance license cost and vector rendering performance.
2. **Mobile Push Notification Gateway**: Confirm Firebase Cloud Messaging (FCM) + Apple Push Notification service (APNs) architecture via unified service (e.g. Supabase Edge Functions / OneSignal).
3. **Database Migration Tooling**: Standardize on Prisma vs. Drizzle ORM vs. native SQL migrations for Phase 02 multi-tenant schema definition.
