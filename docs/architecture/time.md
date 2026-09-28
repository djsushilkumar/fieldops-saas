# FieldOps — Global Time Policy & Timestamp Architecture

---

## 1. Executive Time Policy

Time accuracy is mission-critical in FieldOps. Disputed arrival times, overtime payroll claims, and SLA breaches hinge directly on timestamp integrity.

---

## 2. Non-Negotiable Time Rules

1. **Store Strictly in UTC**: Every timestamp in PostgreSQL (`TIMESTAMPTZ`), API payloads (`IsoDateTime`), and local databases must be serialized in UTC using ISO-8601 format (e.g. `2026-09-28T16:00:00.000Z`).
2. **Convert at Presentation**: Timezone conversions occur strictly at the presentation layer (Web UI / Mobile UI) based on the user's localized timezone or organization preferences.
3. **Never Rely on Client Device Clocks for Server Authority**: Mobile device clocks can be altered by users or drift. Server-side state transitions stamp authoritative `server_timestamp = NOW()`.
4. **Explicitly Distinguish Server from Client Timestamps**:
   - `client_timestamp`: The exact moment a physical action was performed on the mobile device (e.g. tapping "Clock In" in a basement).
   - `created_at` / `server_received_at`: The moment the cloud backend ingested the synchronized mutation.
   - Both timestamps are preserved in database records to enable full auditing.

---

## 3. Offline Event Handling & Time Drift Protection

1. **Monotonic Clocks**: On mobile, duration timers (e.g. on-site dwell time) utilize monotonic hardware timers (`Stopwatch` / `clock_gettime`) to prevent tampering caused by manually altering the device calendar clock.
2. **NTP Drift Detection**: When connected, the mobile app synchronizes with backend headers (`meta.server_time`) to compute clock skew. Skew exceeding 120 seconds triggers an operational warning.
