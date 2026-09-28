# Report & Export Security Policy

## 1. Tenancy & Access Boundary
1. **Tenant Isolation**: Every report query, summary aggregation, and CSV export is strictly scoped to `organization_id = current_tenant_id()`. Multi-tenant RLS prevents any cross-tenant data leakage.
2. **Permission Gate**: Viewing reports requires `Permissions.REPORT_VIEW`. Exporting CSVs requires `Permissions.REPORT_EXPORT`. Unauthenticated or unauthorized actors receive HTTP 403 Forbidden.

## 2. CSV Injection & Sanitization
All CSV cell outputs undergo string escaping per RFC 4180. Any text beginning with sensitive spreadsheet formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) is prepended with a single quote (`'`) to neutralize CSV/formula injection attacks when opened in desktop spreadsheet software.

## 3. Rate Limits & File Storage
- Standard exports are generated as ephemeral, in-memory streaming responses or short-lived signed URLs.
- Maximum row count is clamped at 5,000 records.
- All export invocations are audited in `report_audit_logs`.
