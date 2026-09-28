# ADR-0016: Task Assignment Precedence & Territory Scoping

## Status
Accepted

## Context
In field operations, work is dispatched either directly to an individual technician or to an entire specialized crew/team (e.g., "North HVAC Emergency Crew"). We need clear assignment semantics, authority scoping, and visibility rules when tasks are assigned to individual technicians versus teams.

## Decision
1. A task may specify `assigned_to` (User ID), `assigned_team` (Team ID), or both.
2. When assigned to a team without an individual assignee:
   - All members of the team have visibility and can claim the task (transitioning to `ACCEPTED` and assigning `assigned_to = auth.uid()`).
3. When assigned directly to an individual technician:
   - The task appears in that technician's "My Tasks" queue.
4. Supervisors can only view, dispatch, and modify tasks for teams where the supervisor holds active membership.
5. Organization Admins and Owners possess tenant-wide assignment authority.

## Consequences
- **Positive**: Enables flexible group dispatching while preserving strict technician accountability once on-site.
- **Negative**: Requires team membership checks in PostgreSQL RLS policies.
- **Mitigation**: Database indices on `team_members(organization_id, team_id, user_id)` ensure sub-millisecond RLS policy evaluation.
