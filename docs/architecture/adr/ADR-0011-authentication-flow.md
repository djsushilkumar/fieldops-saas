# ADR-0011: Authentication Flow & Multi-Platform Session Lifecycle

## Status
Accepted

## Context
FieldOps requires a unified authentication architecture spanning two distinct client environments:
1. **Web Console**: Browser-based administrative and dispatcher portal (Next.js 14 App Router) operating in continuous connectivity.
2. **Mobile Client**: Handheld field technician application (Flutter 3.24+) operating under intermittent cellular connectivity, offline-first constraints, and hardware security models.

Previous approaches in legacy SaaS platforms often conflate user account credentials with organization identity or store session tokens in insecure local storage (such as HTML5 `localStorage` or plain text SQLite).

## Decision
1. **Primary Identity Engine**: Standardize on Supabase Auth (GoTrue) delivering standards-compliant RFC 7519 JSON Web Tokens (JWT) for access and cryptographic rotating refresh tokens.
2. **Explicit Auth State Machine**: Implement a 6-state lifecycle on web and mobile:
   `UNKNOWN` → `AUTHENTICATING` → `AUTHENTICATED` | `UNAUTHENTICATED` | `SESSION_EXPIRED` | `AUTH_ERROR`.
3. **Web Storage & Protection**: Access tokens are kept in memory and synchronized via secure, `SameSite=Lax`, `Path=/` cookies inspected by Next.js edge middleware.
4. **Mobile Storage & Keystore**: Tokens are persisted strictly using platform hardware security modules (`SecureStorageContract` wrapping Android Keystore and iOS Keychain). Passwords and session secrets are strictly forbidden in plain SQLite or shared preferences.
5. **Session Expiration & Offline Resilience**: Mobile field technicians retain their local session during cellular dropouts. Expired access tokens do not disrupt local work; renewal occurs automatically when network connectivity is re-established.

## Consequences
### Positive
- Zero exposure of master credentials or plain-text secrets in browser caches or device storage.
- Standardized JWT claims feed PostgreSQL Row-Level Security (`auth.uid()`, `current_tenant_id()`).
- Predictable UX state transitions across both platforms.

### Negative
- Requires maintaining dual session storage adapters (cookie sync for web middleware, keystore for Flutter).
- Requires token refresh handling during intermittent connectivity transitions.
