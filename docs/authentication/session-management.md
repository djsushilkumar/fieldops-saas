# FieldOps — Session Management & Token Rotation

---

## 1. Token Lifecycles & Security Constraints

FieldOps implements single-use rotating refresh tokens with short-lived JWT access tokens.

| Token Parameter | Specification | Purpose |
| :--- | :--- | :--- |
| **Access Token (JWT)** | 60 minutes TTL | Cryptographic bearer token presented in `Authorization: Bearer <token>` |
| **Refresh Token** | 30 days TTL (Rotating) | Opaque secret used to mint new access tokens; family revoked on reuse |
| **Active Organization ID** | Bound to session | Stored in `x-tenant-id` header and session context |

---

## 2. Invalidation & Logout Protocols

When a user initiates logout, or when an administrator suspends a user:

1. **Client Memory Purge**:
   - Access token cleared from runtime memory.
   - Query client cache completely purged.
   - User profile and active organization cleared.
2. **Persistent Storage Purge**:
   - Web: Cookies `fieldops_access_token` and `fieldops_active_org_id` removed (`Max-Age=0`).
   - Mobile: Keystore keys `auth_access_token`, `auth_refresh_token`, `auth_active_tenant_id` deleted via `clearAllSecrets()`.
3. **Server-Side Token Revocation**:
   - API client issues `POST /api/v1/auth/logout`.
   - GoTrue revokes the refresh token family, preventing any further access token minting.
