# FieldOps — Phase 02 Security Baseline & Controls

---

## 1. Security Baseline Mandate

FieldOps enforces a defense-in-depth security model protecting multi-tenant enterprise data across client devices, edge proxies, backend APIs, and the PostgreSQL database.

---

## 2. Core Security Controls Matrix

| Control Domain | Implementation Mechanism | Enforcement Layer |
| :--- | :--- | :--- |
| **Dependency Hygiene** | Frozen lockfile (`pnpm-lock.yaml`), automated Dependabot / vulnerability scanning. | CI Pipeline / Build |
| **Secret Protection** | Automated regex scan for private keys, tokens, and master encryption keys (`tests/security/secret-exposure.test.ts`). | CI Pipeline & Pre-commit |
| **Least Privilege** | Dedicated PostgreSQL roles; anonymous client tokens limited to public routes; service-role key restricted strictly to backend workers. | Supabase / Database Engine |
| **Database Isolation** | PostgreSQL Row-Level Security (`ENABLE` and `FORCE ROW LEVEL SECURITY`) with `current_tenant_id()` policy checks. | PostgreSQL Kernel |
| **Authentication** | Cryptographically signed JWT tokens with 60-minute expiration; single-use refresh token rotation; secure cookie storage on Web. | Supabase Auth (GoTrue) |
| **Mobile Storage** | Hardware Keystore (Android) / Secure Enclave (iOS) via `flutter_secure_storage`. Plaintext token storage is prohibited. | Mobile OS Security Module |
| **File Upload Safety** | Pre-signed upload URLs with strict MIME-type allowlists, size limits (15MB), and asynchronous malware scanning. | Cloud Object Storage |
| **Rate Limiting** | Edge-level IP and token bucket rate limits (10 req/min auth, 600 req/min operational API). | Edge API Gateway |
| **Audit Immutability** | Database trigger `prevent_audit_log_modification()` prohibiting direct `UPDATE` or `DELETE` on `audit_logs`. | PostgreSQL Trigger |
