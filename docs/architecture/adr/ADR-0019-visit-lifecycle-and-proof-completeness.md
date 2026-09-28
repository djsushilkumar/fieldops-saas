# ADR-0019: Visit Lifecycle State Machine and Proof of Work Completeness

## Status
Accepted

## Context
In field operations, verifying that work was genuinely executed at the customer's physical premises is essential. Disorganized or fraudulent job execution frequently stems from workers skipping steps (e.g. marking visits "completed" without arrival, departing without customer sign-off, or failing to capture photographic evidence). We must establish a strict lifecycle state machine and verification gates.

## Decision
1. **Strict Lifecycle State Machine**:
   - Permitted transitions:
     - `SCHEDULED` $\rightarrow$ `READY`, `EN_ROUTE`, `CHECKED_IN`, `MISSED`, `CANCELED`
     - `READY` $\rightarrow$ `EN_ROUTE`, `CHECKED_IN`, `MISSED`, `CANCELED`
     - `EN_ROUTE` $\rightarrow$ `CHECKED_IN`, `MISSED`, `CANCELED`
     - `CHECKED_IN` $\rightarrow$ `IN_PROGRESS`, `CHECKED_OUT`, `CANCELED`
     - `IN_PROGRESS` $\rightarrow$ `CHECKED_OUT`, `CANCELED`
     - `CHECKED_OUT` $\rightarrow$ `COMPLETED`, `CANCELED`
   - Terminal states: `COMPLETED` and `CANCELED`. Once in a terminal state, no further transitions or edits are permitted.
2. **Role-Based Cancellation Authority**:
   - Field Workers are prohibited from canceling visits (`VISIT_CANCEL` denied).
   - Only Supervisors, Managers, Admins, and Owners possess cancellation authority.
3. **Mandatory Checkout Requirement**:
   - A visit cannot transition from `CHECKED_OUT` to `COMPLETED` without a corresponding `visit_checkouts` record establishing duration and departure verification.
4. **Server-Enforced Proof Completeness**:
   - If a visit requires proof of work (e.g., photo evidence, signature, or checklist completion), the state machine evaluator verifies `proofCount >= requiredProofCount` before allowing completion.
5. **Append-Only Activity Ledger**:
   - Every status transition automatically appends an immutable entry to `visit_activities`, recording the timestamp, actor, previous status, and new status. Database triggers prevent modification or deletion of activity records.

## Consequences
- **Positive**:
  - Eliminates fake completions and ensures every completed field visit contains tamper-proof arrival, departure, and evidence records.
  - Supervisors have immediate visibility into skipped steps or missing proofs.
- **Negative**:
  - Workers must explicitly checkout before completing, adding a step if they forget.
- **Mitigation**:
  - Mobile app prompts workers with a single-tap "Record Departure & Complete" workflow when all proofs are attached, executing checkout and completion sequentially.
