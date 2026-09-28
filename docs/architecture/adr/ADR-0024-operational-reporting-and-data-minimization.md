# ADR-0024: Operational Reporting Architecture & Data Minimization

## Context

FieldOps organizations require operational reports (Tasks SLA, Visits & GPS Verification, Attendance, Workforce activity) with export capabilities (CSV, JSON).
Operational reporting introduces critical architectural and privacy considerations:
1. **Separation of Concerns**: Operational reporting must derive strictly from authoritative operational tables (`tasks`, `visits`, `attendance_records`, `worker_activities`) without coupling to commercial billing data.
2. **Location Privacy & Data Minimization (ADR-0020)**: Field worker physical privacy must be safeguarded. Exported reports should not expose fine-grained GPS breadcrumbs or point coordinates when not legally or operationally required.
3. **No Toxic Performance Rankings**: Reports must present factual execution metrics (tasks completed, visits attended) without creating automated "top/bottom performer" judgment algorithms.
4. **Export Safety**: File exports must be bounded (maximum rows), authenticated, tenant-isolated, and RFC 4180 compliant to prevent formula injection and buffer exhaustion.

## Decision

1. **Reporting Architecture**:
   - Reporting queries are server-authoritative, executed with PostgreSQL parameters partitioned by `current_tenant_id()`.
   - Complex reporting queries utilize indexed columns (`organization_id, due_at, status`, `organization_id, scheduled_start, status`, `organization_id, date`).
   - Summary KPIs are computed server-side with zero division-by-zero vulnerabilities.

2. **Data Minimization in Exports**:
   - Visit and attendance exports default to reporting the **discrete verification result** (`VALID`, `OUTSIDE_RADIUS`, `LOW_ACCURACY`), verified location name, and timestamps.
   - Raw latitude/longitude coordinates are excluded from standard exports.
   - Exact physical addresses of customer sites are included only when relevant to dispatched work.

3. **CSV Export Standards**:
   - RFC 4180 compliance: fields containing commas, quotes, or newlines are quoted with double quotes escaped (`""`).
   - UTF-8 with Byte Order Mark (BOM) header for reliable rendering across spreadsheet tools (Excel, Numbers, Sheets).
   - Maximum export limit of 5,000 rows in V1. Queries exceeding the limit return an explicit `REPORT_RANGE_TOO_LARGE` error.
   - Every export action is logged to `report_audit_logs` (actor, tenant, report type, filter parameters, export timestamp).

4. **Workforce Objectivity**:
   - Workforce reports present neutral operational counts: tasks assigned, tasks completed, visits attended, and shift attendance.
   - No automated performance scoring, employee grading, or competitive ranking algorithms are permitted.

## Consequences

- Full compliance with privacy standards and labour regulations regarding surveillance minimization.
- Reliable, deterministic report generation that cannot crash browser memory.
- Clear audit trail of who exported operational data and when.
