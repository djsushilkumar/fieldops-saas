# ADR-0006: Global Time Policy & Timestamp Strategy

- **Status**: Accepted
- **Date**: 2026-09-28
- **Author**: Lead Software Architect

---

## 1. Context

In a field force management platform, timestamps determine employee pay, SLA compliance, customer billing disputes, and verified presence. Mobile clients operate in varying timezones and frequently capture events while offline.

---

## 2. Problem

How should timestamps be generated, serialized, stored, and audited across distributed mobile clients and central cloud databases?

---

## 3. Options Considered

1. **Local Timezone Storage with Offset (ISO with variable offset)**:
   - *Pros*: Preserves the local wall-clock time directly in the string.
   - *Cons*: Query sorting, aggregation, and interval arithmetic across teams in different timezones become error-prone; indexing is less efficient.
2. **Server-Only Timestamping (Ignore client time)**:
   - *Pros*: Completely immune to client clock tampering.
   - *Cons*: Fails when workers operate offline. A task completed at 09:00 AM in a basement that syncs at 05:00 PM would be falsely recorded as taking 8 hours.
3. **Dual Timestamping (UTC Canonical Storage + Explicit Client/Server Separation)**:
   - *Pros*: All database columns use PostgreSQL `TIMESTAMPTZ` stored in UTC.
   - Offline mutations record the physical moment of action (`client_timestamp`) alongside the ingestion time (`created_at` / `server_received_at`).
   - Presentation layer converts UTC to organization/user localized timezones.

---

## 4. Decision

We will implement **Option 3: Dual Timestamping with Canonical UTC Storage**:
- Database columns store `TIMESTAMPTZ` in UTC.
- APIs use ISO-8601 UTC strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- Mobile clients record hardware monotonic elapsed time alongside `client_timestamp`.
- Presentation layers convert to local timezones using timezone offsets stored in organization settings.

---

## 5. Consequences

- **Positive**: Consistent global temporal math; complete transparency during wage/SLA dispute resolution; full offline auditability.
- **Negative**: UI components must always format timestamps through localization helpers.
