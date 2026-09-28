# FieldOps — Configuration & Environment Strategy

---

## 1. Configuration Principles

Configuration management in FieldOps enforces strict boundary separation between:
1. **Public Client Configuration**: Values safe to expose in web browser source code and mobile application bundles.
2. **Server-Side Secret Configuration**: Highly sensitive cryptographic keys and database credentials that must **never** reach clients.

---

## 2. Canonical Environment Variables Reference

| Variable Name | Scope | Sensitivity | Purpose & Validation Rules |
| :--- | :--- | :---: | :--- |
| `APP_ENV` | Global | Public | Current environment: `development`, `staging`, `production`, `test`. |
| `NEXT_PUBLIC_APP_URL` | Web | Public | Canonical web URL (e.g. `https://app.fieldops.io`). Must be valid URL. |
| `NEXT_PUBLIC_API_URL` | Web / Mobile | Public | Base URL for API endpoints (e.g. `https://api.fieldops.io/v1`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Web / Mobile | Public | Supabase gateway URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web / Mobile | Public | Supabase anonymous JWT key; constrained by database RLS. |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | Web / Mobile | Public | Boolean flag controlling client telemetry opt-in. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-Only | **SECRET** | Privileged admin key. Bypasses RLS. Strictly prohibited on clients. |
| `SERVER_SECRET_MASTER_ENCRYPTION_KEY`| Server-Only | **SECRET** | 256-bit hex key (min 32 chars) for field-level encryption at rest. |
| `DATABASE_URL` | Server-Only | **SECRET** | Direct PostgreSQL connection string for migrations and workers. |
| `LOG_LEVEL` | Server-Only | Public | Minimum logging threshold: `debug`, `info`, `warn`, `error`. |

---

## 3. Runtime Schema Validation via `@fieldops/config`

All environment variables are parsed and validated on application startup using Zod schemas:
- **Fail Fast**: If a required variable is missing or malformed, the process terminates immediately with an explicit diagnostic error rather than failing silently during user requests.
- **Browser Protection**: Calling `loadServerConfig()` in a browser context throws an immediate security violation:
  ```typescript
  if (typeof window !== 'undefined') {
    throw new Error('[FieldOps Security Violation] Attempted to load server secrets within browser environment.');
  }
  ```
- **Automated CI Scanning**: The security test suite (`tests/security/secret-exposure.test.ts`) verifies on every pull request that server secret names do not appear in client packages.
