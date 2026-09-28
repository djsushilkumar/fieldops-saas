# FieldOps — Structured Logging Specification

---

## 1. Logging Principles

FieldOps standardizes on **structured JSON logging** across backend services, edge functions, and client applications. Unstructured plain text strings (`console.log("here")`) are strictly forbidden in production code.

---

## 2. Standard Structured Log Format

Every log entry emits a valid single-line JSON object adhering to this schema:

```json
{
  "timestamp": "2026-09-28T16:00:00.123Z",
  "level": "INFO",
  "request_id": "req_1727539200_abc123",
  "organization_id": "00000000-0000-0000-0000-000000000001",
  "user_id": "e0000000-0000-0000-0000-000000000005",
  "operation": "visit:check_in",
  "message": "Field worker checked in at customer site.",
  "metadata": {
    "visit_id": "018f2e23-74d3-7d24-811c-d7e174244d28",
    "distance_meters": 42.5,
    "result": "VALID"
  }
}
```

---

## 3. Strict Secret Redaction Policy

To prevent credential leakage into centralized logging aggregators (e.g. Datadog, CloudWatch), logging wrappers automatically redact the following sensitive keys:
- `password`, `current_password`, `new_password`
- `token`, `access_token`, `refresh_token`
- `authorization`, `cookie`, `set-cookie`
- `secret`, `api_key`, `service_role_key`
- `master_encryption_key`

Any key matching this list (case-insensitive) is replaced with `"[REDACTED]"` prior to serialization.

---

## 4. Log Levels & Usage

- **`DEBUG`**: Detailed diagnostic traces, SQL parameter shapes (sanitized), and local sync queues. Suppressed in production.
- **`INFO`**: Key operational events (successful check-in, task state transition, batch sync committed).
- **`WARN`**: Handled operational exceptions (geofence distance exceptions, sync conflicts, transient network retries).
- **`ERROR`**: Unhandled exceptions, 5xx server failures, and security authorization rejections.
