# ADR-0001: Identifier Generation Strategy

- **Status**: Accepted
- **Date**: 2026-09-28
- **Author**: Lead Software Architect

---

## 1. Context

FieldOps operates across distributed mobile devices and cloud servers. Mobile workers generate new domain entities (task notes, check-ins, proof attachments) while disconnected. Traditional auto-incrementing integer IDs (`SERIAL` / `BIGINT`) fail in distributed offline environments because clients cannot coordinate sequence allocation without round-trip network connectivity.

---

## 2. Problem

Which globally unique identifier format should FieldOps adopt to ensure safe offline creation, B-Tree index performance, time-sortability, and seamless PostgreSQL compatibility?

---

## 3. Options Considered

1. **UUIDv4 (Random UUID)**:
   - *Pros*: Universally supported by PostgreSQL (`gen_random_uuid()`) and programming languages; standard 128-bit format.
   - *Cons*: Completely non-sequential/random; causes severe B-Tree index fragmentation and cache eviction at scale.
2. **ULID (Universally Unique Lexicographically Sortable Identifier)**:
   - *Pros*: 128-bit, 48-bit timestamp prefix, Crockford Base32 encoded (26 chars), URL-friendly.
   - *Cons*: Lacks native PostgreSQL 15 `uuid` type binary representation without custom conversion extensions.
3. **UUIDv7 (RFC 9562 Time-Ordered UUID)**:
   - *Pros*: Native 128-bit standard UUID binary format (`8-4-4-4-12`); encodes millisecond Unix timestamp in the leading 48 bits; perfectly sequential for B-Tree indexing; easily generated offline by mobile devices and servers with zero coordination.
   - *Cons*: Relatively new standard, though fully compatible with standard UUID parsers and PostgreSQL `UUID` column types.

---

## 4. Decision

We will standardize on **UUIDv7** for all domain entity primary keys and offline mutation identifiers:
- Both client applications (Flutter `uuid` package) and backend services generate UUIDv7.
- Database columns use native PostgreSQL `UUID` type, ensuring optimal 16-byte storage and index compactness.
- UUIDv4 remains accepted as a fallback when client timestamps are uncertain.

---

## 5. Consequences

- **Positive**: Excellent PostgreSQL B-Tree insert performance; natural chronological sorting without requiring secondary timestamp index lookups; 100% offline generation safety.
- **Negative**: Developers must ensure client clock synchronization when debugging millisecond order.
