# Timezone Strategy for Operational Reporting & Billing

## 1. Principles & Standard Storage

1. **Storage Canonicalization**:
   All timestamps across the FieldOps platform (`due_at`, `scheduled_start`, `check_in_at`, `current_period_end`, `created_at`, etc.) are persistently stored in **UTC (ISO-8601 with trailing `Z`)** in PostgreSQL (`timestamptz`).

2. **Organization Operational Timezone**:
   Every organization specifies an operational timezone in its settings (e.g. `organization.settings.timezone = 'America/New_York'` or `'Asia/Kolkata'`). Defaults to `UTC` if unset.

3. **Date Boundary Interpretation in Reports**:
   When an operational report filters by date range (e.g., `From: 2026-09-01` to `To: 2026-09-30`), the boundaries are interpreted using the **organization's configured timezone**:
   - `Start Window`: `2026-09-01T00:00:00.000` in Organization Timezone converted to UTC.
   - `End Window`: `2026-09-30T23:59:59.999` in Organization Timezone converted to UTC.
   This guarantees that work performed at 11:30 PM local operational time falls on the expected operational date rather than rolling into the next UTC calendar day.

4. **Billing Period Boundaries**:
   Subscription billing periods are determined by the authoritative subscription timestamps (`current_period_start`, `current_period_end`) stored in UTC. Usage metering counters reset according to `period_start` and `period_end` timestamps matching the subscription cycle.
