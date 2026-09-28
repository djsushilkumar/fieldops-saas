# ADR-0008: API Protocol & Contract Conventions

- **Status**: Accepted
- **Date**: 2026-09-28
- **Author**: Lead Software Architect

---

## 1. Context

FieldOps services communicate with web dashboards, mobile applications, and future third-party integrations. Without strict API standards, endpoint responses drift into inconsistent formats, making client parsing fragile and error handling unpredictable.

---

## 2. Problem

Which API protocol and contract design pattern provides the greatest predictability, type safety, error clarity, and cross-platform mobile compatibility?

---

## 3. Options Considered

1. **GraphQL**:
   - *Pros*: Precise client query selection.
   - *Cons*: Difficult caching; complex file upload pipelines; heavy client SDK overhead for mobile Flutter apps; complex rate-limiting.
2. **tRPC**:
   - *Pros*: End-to-end type safety in full-stack TypeScript.
   - *Cons*: Limited to TypeScript-to-TypeScript environments; poor native integration with Flutter/Dart mobile clients.
3. **Versioned REST with Standardized JSON Envelopes & Zod Validation**:
   - *Pros*: Universally supported by web and mobile; simple HTTP caching; straightforward multipart file uploads; standardized response envelope `{ success, data, meta }` and error structure `{ success, error: { code, message, request_id } }`; shared validation schemas via `@fieldops/validation`.

---

## 4. Decision

We will standardize on **Versioned REST (`/api/v1/*`) with Standardized JSON Envelopes**:
- **Success Format**: `{ success: true, data: T, meta?: {} }`
- **Error Format**: `{ success: false, error: { code: ErrorCode, message: string, request_id: string, details?: {} } }`
- **Error Codes**: Machine-readable enum values (`VALIDATION_ERROR`, `AUTHORIZATION_ERROR`, etc.) rather than arbitrary English string matching.
- **Request Tracing**: `x-request-id` header propagated on every request and returned in every response/error.
- **Client Library**: `@fieldops/api` encapsulates transport, authentication, retry, and error normalization.

---

## 5. Consequences

- **Positive**: Seamless cross-platform support across Web and Flutter; clear machine-readable errors; decoupled contract definition.
- **Negative**: Requires maintaining shared validation schemas and endpoint documentation.
