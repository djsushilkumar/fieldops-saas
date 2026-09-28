# AGENTS.md — FieldOps Engineering Agent Rules & Governance

This document establishes the binding operational rules for all AI coding agents, autonomous agents, and contributors working in the **FieldOps** repository.

---

## 1. Core Operating Principles

FieldOps is a mission-critical multi-tenant SaaS platform for field force management and task management. Operational integrity, data privacy, tenant isolation, and offline data safety are paramount.

Every agent working on this codebase must strictly adhere to the following twenty rules.

---

## 2. The Twenty Mandatory Rules

1. **Work only within the active phase.** Never implement future-phase functionality without explicit authorization.
2. **Never implement future-phase functionality without explicit authorization.** Maintain strict phase-gate discipline.
3. **Read documentation before changing architecture.** Always consult `docs/` and existing Architecture Decision Records (ADRs) prior to introducing design changes.
4. **Never bypass authentication.** Every client request, background worker invocation, and API endpoint must be authenticated unless explicitly designed as a public endpoint.
5. **Never bypass authorization.** Client-side role checks are cosmetic; all authorization decisions must be validated server-side.
6. **Never bypass tenant isolation.** Every query, mutation, storage object, and cache key must be partitioned by Organization ID (`tenant_id`).
7. **Never expose privileged credentials.** Service keys, database master passwords, signing secrets, and third-party tokens must never be sent to mobile or web clients.
8. **Every database modification requires a migration.** No ad-hoc schema changes. Migrations must be version-controlled, reversible, and tested for multi-tenant safety.
9. **Every feature requires tests.** Unit tests, integration tests, and tenant isolation tests must be delivered alongside any new code.
10. **Never delete tests to make CI pass.** A failing test highlights an architectural or implementation defect, not a test nuisance.
11. **Never weaken security to solve a test failure.** Bypassing authentication, disabling RLS, or relaxing validation rules in test suites is strictly forbidden.
12. **Never silently change public contracts.** API schemas, event envelopes, and shared data types are contracts. Breaking changes require documentation and versioning.
13. **Never introduce dependencies without documenting the reason.** Every new third-party library, package, or SDK must be justified regarding license, security footprint, and bundle impact.
14. **Never mark incomplete work as complete.** If a task is partially implemented, document the exact gap, flag the open items, and do not mark it done.
15. **Document architectural decisions.** When introducing structural decisions, use the Architecture Decision Record (ADR) process under `docs/architecture/adr/`.
16. **Keep mobile and web behavior consistent with product requirements.** Ensure parity in domain semantics, state transitions, validation rules, and error messages.
17. **Offline operations must be recoverable.** Mobile local mutations must be durable, queued with idempotency keys, and protected against data loss during crashes or connectivity loss.
18. **Destructive operations require explicit confirmation where appropriate.** Deletions, cancellations, team reassignments, and tenant data purges require explicit safeguards and confirmation.
19. **Sensitive operations must be auditable.** Membership changes, role elevation, geofence overrides, manual attendance corrections, and export actions must be logged in the immutable audit log.
20. **Product scope is controlled by the PRD.** Features outside the Product Requirements Document (`docs/product/PRD.md`) and V1 Scope (`docs/product/scope.md`) are forbidden unless approved through product governance.

---

## 3. Active Phase Governance

- **Completed Phases**:
  - **Phase 01 — Product, Brand & Foundation**: PRD, Personas, Roles, Brand, Design Tokens, QA Strategy.
  - **Phase 02 — Architecture + Monorepo + Engineering Foundation**: Monorepo, Workspaces, Packages, Web/Mobile shell foundations, Database contract, CI pipeline.
  - **Phase 03 — Identity, Multi-Tenancy & Access Control**: PostgreSQL RLS, Web/Mobile Authentication, RBAC, Final Owner Protection, Invitations, Security Tests.
  - **Phase 04 — Task Management Engine**: Task Domain, State Machine, Checklists, Attachments, Comments, Append-Only Activities, Web UI, Mobile Tabbed Views, Offline Mutation Queue & Idempotency.
  - **Phase 05 — Field Operations, Visits, GPS Verification & Proof of Work**: Geofenced Locations, Visit Lifecycle State Machine, Haversine Distance Calculation, Check-in/out, Exception Overrides, Proofs (Photos, Signatures, Notes), Offline Visits Queue, Security & Geospatial Suites.
  - **Phase 06 — Attendance & Shift Tracking**: Shift clock-in/out, GPS point-in-time acquisition, duration calculation, duplicate shift prevention, audited manual adjustments, worker activity ledger, web attendance board, mobile duty timer, offline mutation queueing, and tenant isolation.
  - **Phase 07 — Manager/Admin Web Operations Dashboard**: Situational awareness operations dashboard, 6 core KPIs, operational exception alerts, Day/Week calendar dispatch views, geospatial operational live map with discrete check-in pins and accessible table toggle, workforce roster, team crew management, immutable worker activity ledger, tenant-scoped realtime query invalidation, and role-scoped operational navigation.
  - **Phase 08 — Reports, Exports, Usage Metering & SaaS Billing**: Operational reports (Tasks, Visits & Geofences, Attendance & Shifts, Workforce Activity), RFC 4180 CSV builder with UTF-8 BOM and formula sanitization, bounded row limits (5,000 max), report audit logs, data minimization (discrete location verification result, no raw GPS breadcrumbs), SaaS subscriptions (FREE, STARTER, GROWTH, BUSINESS), centralized entitlement matrices, atomic usage counter functions (`check_and_increment_usage`), BillingProvider abstraction & deterministic MockBillingProvider, webhook idempotency (`provider_event_id`), customer portal, non-destructive downgrade invariance, and Owner/Admin billing console UI.
- **Current Active Phase**: **Phase 08 Completed (Reports, Exports, Usage Metering & SaaS Billing)**
- **Strictly Prohibited in Current State**:
  - Implementing live business functionality outside active phase boundaries: Live continuous GPS hardware drivers / fleet telematics, Route optimization dispatch algorithms, AI assistants, CRM, or Chat feeds.
  - Adding unvetted external dependencies.


---

## 4. AI Agent Safety & Execution Protocol

Future AI coding agents working on this repository must execute tasks according to this mandatory protocol:
1. **Read AGENTS.md first** to confirm active phase constraints and governance rules.
2. **Read relevant architecture documentation** under `docs/architecture/` before modifying code.
3. **Identify active phase boundaries** and verify that requested changes do not cross phase gates.
4. **Implement the smallest valid change** that completely satisfies the immediate requirement.
5. **Add tests alongside every change** (unit, integration, or security tests).
6. **Run local validation suites** (`pnpm typecheck`, `pnpm test`, `flutter test`) to verify correctness.
7. **Update documentation** whenever an architectural or contract change is made.
8. **Report test and build results factually**; never claim a task passed without automated verification.
9. **Never bypass CI or weaken security** to force green status.

---

## 5. Architectural Boundaries & Monorepo Rules

- **Web Application (`apps/web`)**: Next.js App Router for management consoles. Must consume `@fieldops/api`, `@fieldops/config`, `@fieldops/types`, and `@fieldops/design-tokens`. Must not duplicate backend validation logic or access PostgreSQL directly.
- **Mobile Application (`apps/mobile`)**: Flutter 3.24+ for field workers. Must use Riverpod for state and Drift/SQLite for local persistence. Must strictly route all mutations through the offline mutation queue.
- **Shared Packages (`packages/*`)**: Decoupled, modular TypeScript packages. `@fieldops/types` contains no runtime side-effects; `@fieldops/config` prevents server secret exposure; `@fieldops/design-tokens` is the single source of truth for styles.
- **Database (`supabase/`)**: All migrations live in `supabase/migrations/` with sequential timestamp naming. Every tenant-owned table must enable PostgreSQL Row-Level Security (`current_tenant_id()`).

---

## 6. Conflict Resolution & Consistency Protocol

If an agent identifies an ambiguity, contradiction, or discrepancy in specifications:
1. Do not make arbitrary assumptions or silently select one path.
2. Check `docs/product/open-decisions.md` to see if the item is already recorded.
3. If unrecorded, document the contradiction in `docs/product/open-decisions.md` with file references, impact, trade-offs, and proposed resolution.
4. Escalate to the product architect / user before proceeding with implementation.

---

## 7. Artifact Directory & File Hygiene

- Active project workspace: `/workspace/clever-darwin`.
- All project files must remain within `/workspace/clever-darwin`.
- Do not create project output under `~/.gemini/antigravity-cli/scratch` or temporary directories outside the workspace.
- Preserve all existing file headers, documentation integrity, and Markdown structure.
