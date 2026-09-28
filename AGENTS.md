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

- **Active Phase**: **Phase 01 — Product, Brand & Foundation**
- **Current Allowed Activity**: Documentation, specifications, architecture blueprints, design tokens, personas, user journeys, testing strategy.
- **Strictly Prohibited in Phase 01**:
  - Writing Next.js, Flutter, React, or mobile application code
  - Initializing live database instances or running active Supabase/PostgreSQL projects
  - Creating mock API servers or production endpoints
  - Implementing GPS drivers, push notification workers, or payment webhooks
  - Installing heavy application dependencies

---

## 4. Conflict Resolution & Consistency Protocol

If an agent identifies an ambiguity, contradiction, or discrepancy in specifications:
1. Do not make arbitrary assumptions or silently select one path.
2. Check `docs/product/open-decisions.md` to see if the item is already recorded.
3. If unrecorded, document the contradiction in `docs/product/open-decisions.md` with:
   - File references and conflicting statements
   - Business & architectural impact
   - Proposed options and trade-offs
   - Recommended resolution
4. Escalate to the product architect / user before proceeding with implementation.

---

## 5. Artifact Directory & File Hygiene

- Active project workspace: `/workspace/clever-darwin`.
- All project files must remain within `/workspace/clever-darwin`.
- Do not create project output under `~/.gemini/antigravity-cli/scratch` or temporary directories outside the workspace.
- Preserve all existing file headers, documentation integrity, and Markdown structure.
