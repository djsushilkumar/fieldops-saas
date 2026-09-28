# FieldOps — API Architecture & Contract Conventions

---

## 1. API Philosophy

FieldOps exposes a clean, predictable, versioned REST/JSON API interface (`/api/v1/*`). Every endpoint enforces strict authentication, server-side authorization, schema-based payload validation, request ID correlation, and normalized error responses.

---

## 2. Standardized Response Envelopes

Every API response returns a consistent JSON envelope to eliminate client parsing ambiguity.

### 2.1. Success Response Structure
```json
{
  "success": true,
  "data": {
    "id": "018f2e23-74d3-7d24-811c-d7e174244d28",
    "title": "Inspect Emergency Substation",
    "status": "ASSIGNED"
  },
  "meta": {
    "server_time": "2026-09-28T16:00:00.000Z"
  }
}
```

### 2.2. Paginated Response Structure
```json
{
  "success": true,
  "data": {
    "items": [
      { "id": "018f2e23-...", "title": "Job A" },
      { "id": "018f2e23-...", "title": "Job B" }
    ],
    "pagination": {
      "total": 142,
      "page": 1,
      "pageSize": 20,
      "hasMore": true,
      "nextCursor": "eyJpZCI6IjAxOGYyZTIz..."
    }
  }
}
```

### 2.3. Error Response Structure
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid task parameters provided.",
    "request_id": "req_1727539200_abc123",
    "details": {
      "due_datetime": "Must be an ISO-8601 formatted date string in the future."
    }
  }
}
```

> [!IMPORTANT]
> Internal stack traces and database error codes must **never** be exposed in client error envelopes. All unexpected errors map cleanly to `INTERNAL_ERROR` with a correlated `request_id` for backend log inspection.

---

## 3. Standardized Error Taxonomy

| Error Code | HTTP Status | Typical Cause |
| :--- | :---: | :--- |
| `AUTHENTICATION_ERROR` | 401 | Missing, malformed, or expired JWT access token. |
| `AUTHORIZATION_ERROR` | 403 | Authenticated user lacks permission to access the specified resource. |
| `VALIDATION_ERROR` | 400 | Request body or query parameters violate Zod schema constraints. |
| `NOT_FOUND` | 404 | Resource does not exist or belongs to another tenant. |
| `CONFLICT` | 409 | Unique constraint violation, concurrency collision, or stale optimistic lock. |
| `RATE_LIMITED` | 429 | Client IP or user exceeds rate limit threshold. |
| `GEOFENCE_EXCEPTION` | 422 | Check-in coordinates exceed registered location radius. |
| `SYNC_ERROR` | 422 | Client mutation payload conflicts with current state machine. |
| `INTERNAL_ERROR` | 500 | Unhandled server exception (logged with stack trace internally). |

---

## 4. Request Correlation & Header Propagation

Every HTTP interaction propagates these headers:
- `x-request-id`: A client-generated or edge-injected identifier (`req_[timestamp]_[random]`). Included in all application logs, database queries, and error envelopes.
- `x-tenant-id`: Optional client hint specifying the active organization context for multi-org users; verified cryptographically against the user's JWT `app_metadata`.
- `Authorization`: `Bearer [jwt_token]` for all authenticated endpoints.
- `Idempotency-Key`: Required for offline mutation submissions (`POST /api/v1/sync/mutations`) to guarantee safe retries.

---

## 5. Rate Limiting Policy

1. **Public / Auth Endpoints** (`/api/v1/auth/*`): 10 requests per minute per IP address.
2. **Authenticated Operational Endpoints** (`/api/v1/*`): 600 requests per minute per user.
3. **Offline Sync Ingestion** (`/api/v1/sync/mutations`): 120 requests per minute per field worker.
