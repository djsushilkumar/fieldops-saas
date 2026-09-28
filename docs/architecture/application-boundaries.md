# FieldOps — Application Boundaries & Architectural Separation

---

## 1. Boundary Philosophy

Clear boundaries prevent architectural erosion. Each application and shared package in FieldOps possesses a well-defined responsibility boundary and explicit rules regarding what logic it may—and may not—contain.

---

## 2. Component Responsibility Matrix

| Layer / Application | Primary Responsibility | Permitted Logic | Prohibited Logic |
| :--- | :--- | :--- | :--- |
| **Web Console (`apps/web`)** | Management, dispatch, calendar, live map, audit review, reports | UI composition, responsive layout, form handling, client-side caching via TanStack Query | Direct database access, privileged secret consumption, duplicated validation schemas |
| **Mobile Client (`apps/mobile`)** | Field execution, GPS check-in/out, proof-of-work capture, offline queue | Local storage reads/writes, sensor access (Camera, GPS), background mutation queueing | Bypassing offline queue, storing unencrypted tokens, arbitrary status mutation |
| **Shared Types (`@fieldops/types`)** | Single source of truth for interfaces, branded IDs, and enums | Type definitions, branded nominal types, status enums, API envelope contracts | Executable runtime business logic, network I/O, heavy external dependencies |
| **Validation (`@fieldops/validation`)** | Runtime schema enforcement for domain payloads | Zod schemas, data coercion, format regexes | Database queries, state mutation, network calls |
| **Config (`@fieldops/config`)** | Environment parsing and security boundary protection | Reading `process.env`, parsing Zod schemas, browser detection, failing fast on missing keys | Exposing server secrets to client bundles |
| **API Client (`@fieldops/api`)** | Transport abstraction for HTTP/REST communications | HTTP headers, request ID injection, retry policies with backoff, typed error normalization | Business workflows, UI state management |
| **Backend / Database (`supabase/`)** | Authoritative state storage, multi-tenant enforcement, transaction boundaries | PostgreSQL schemas, RLS policies, cryptographic hashing, PostGIS spatial queries | Trusting client-claimed roles without JWT verification |

---

## 3. Strict Boundary Rules

1. **No Duplicated Validation**: Form validation on the Web and Mobile must share or mirror the exact schemas defined in `@fieldops/validation`. Never create conflicting field constraints (e.g. 50-character limit on mobile vs 100 on web).
2. **No Direct Database Access from Clients**: Neither `apps/web` nor `apps/mobile` may directly connect to PostgreSQL port 5432 or execute raw SQL strings. All communication flows through authenticated HTTPS/WSS APIs.
3. **No Domain Model Bloat in Client Packages**: UI components must consume view models or standardized API responses rather than implementing custom state machines. The authoritative state machine transitions (`DRAFT` $\rightarrow$ `COMPLETED`) reside in the backend.
