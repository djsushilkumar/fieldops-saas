# ADR-0012: Authorization Model & Granular RBAC

## Status
Accepted

## Context
FieldOps operates as a multi-tenant operations platform where users may belong to multiple organizations with different responsibilities. Furthermore, within a tenant, access must distinguish between governance (Owner), administration (Admin), department dispatch (Manager), crew oversight (Supervisor), and direct task execution (Field Worker).

Relying on client-side role toggles or coarse boolean flags (`isAdmin`) creates privilege escalation vulnerabilities and violates FieldOps Rule 5 ("Never bypass authorization").

## Decision
1. **Organization-Scoped Roles**: A user account possesses no global system role. Permissions are bound strictly to a user's **Membership** within a specific Organization (`tenant_id`).
2. **Authoritative Five System Roles**:
   - `OWNER`: Full organization ownership, billing governance, tenant lifecycle.
   - `ADMIN`: Operational management, user onboarding/offboarding, role assignment.
   - `MANAGER`: Department operations, cross-team dispatch, schedules.
   - `SUPERVISOR`: Team-scoped crew oversight, check-in verification, proof approval.
   - `FIELD_WORKER`: Self-scoped execution, task transitions, geofenced clock-in.
3. **Capability Matrix Engine**: Granular permissions are modeled as capability strings evaluated by the centralized `can(role, permission, context)` function in `@fieldops/types`.
4. **Privilege Escalation Barriers**:
   - `ADMIN` is strictly forbidden from assigning the `OWNER` role, deactivating an `OWNER`, or deleting the organization.
   - Only `OWNER` can modify billing instruments or delete the organization.
   - Object-level rules prevent Supervisors and Field Workers from observing or modifying data outside their assigned teams or own assigned tasks.
5. **Server-Side Enforcement Invariant**: UI element visibility is purely cosmetic; all API routes and PostgreSQL RLS policies enforce role permissions independently.

## Consequences
### Positive
- Strict defense against horizontal and vertical privilege escalation.
- Clear auditability on all privileged actions.
- Consistent domain semantics across web and mobile applications.

### Negative
- Requires passing contextual resource identifiers (`assigneeId`, `teamId`) into permission evaluators for object-level checks.
