# ADR-0014: Membership Lifecycle, Invitations & Final Owner Protection

## Status
Accepted

## Context
Organizations require dynamic personnel lifecycles: onboarding employees via email invitations, updating roles during promotions, suspending workers during disciplinary reviews or terminations, and offboarding.

Key risks addressed:
1. **Orphaned Organizations**: If an organization's sole Owner is deleted, removed, or demoted, the tenant becomes permanently unmanageable.
2. **Replay / Leaked Invitation Attacks**: If invitations use permanent predictable tokens, unauthorized third parties can join the tenant.
3. **Ghost Session Access**: If a deactivated employee retains valid access tokens, they could continue extracting organizational records.

## Decision
1. **Four Deterministic Membership States**:
   - `INVITED`: Invitation issued; awaiting token redemption.
   - `ACTIVE`: Fully authenticated active member within organization scope.
   - `SUSPENDED`: Temporarily revoked; immediately rejected by RLS and API filters.
   - `REMOVED`: Permanently detached; cannot access tenant data.
2. **Database Trigger: Final Owner Protection**:
   - Implemented `trg_prevent_last_owner_removal` executing `prevent_last_owner_removal()` in PostgreSQL.
   - Any `DELETE` or `UPDATE` attempting to remove, suspend, or demote the last remaining `ACTIVE` `OWNER` of an organization raises an uncatchable database exception.
3. **Cryptographic Single-Use Invitations**:
   - `organization_invitations` generates high-entropy 32-byte secret tokens.
   - Database stores strictly the `SHA-256` token hash (`token_hash`), never the raw token.
   - Invitations expire strictly after 7 days (`NOW() < expires_at`).
   - Single-use state transition: Once accepted, status shifts to `ACCEPTED`; replay attempts fail with `INVITATION_INVALID`.
4. **Immediate Status Revocation**:
   - Updating status to `SUSPENDED` or `REMOVED` triggers immediate rejection across API endpoints and invalidates active refresh tokens.

## Consequences
### Positive
- Guaranteed organization survivability: zero possibility of orphaned tenants without an active Owner.
- Tamper-proof invitation redemption resistant to database breaches (tokens are hashed).
- Instant deactivation enforcement for security offboarding.

### Negative
- Multi-owner organizations must ensure at least one Owner remains active prior to reassigning roles.
