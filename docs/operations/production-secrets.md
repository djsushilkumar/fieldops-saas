# Production Secret Management & Rotation Runbook — FieldOps SaaS

| Document Version | 1.0.0 |
| :--- | :--- |
| **Phase** | **Phase 10 — Production Launch & Operations** |
| **Storage Standard** | **AWS Secrets Manager / HashiCorp Vault (AES-256 Encrypted)** |
| **Audit Requirement** | **Zero secrets in Git repositories; privileged access logged** |

---

## 1. Secret Inventory & Environment Separation

Every secret in the FieldOps infrastructure is partitioned strictly across **Development**, **Staging**, and **Production**. Under no circumstances may a production secret be utilized in staging or local environments.

| Secret Name | Purpose | Target Environment | Owner | Storage Mechanism | Rotation Cadence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` / `DIRECT_URL` | PostgreSQL direct and pooled database connection credentials | Prod / Staging | Lead DBA / SRE | AWS Secrets Manager (`fieldops/prod/db`) | 90 days |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend service-role JWT bypassing RLS for worker jobs & cron | Prod / Staging | SRE Lead | AWS Secrets Manager (`fieldops/prod/supabase`) | 180 days |
| `SERVER_SECRET_MASTER_ENCRYPTION_KEY` | AES-256-GCM symmetric key for field-level database encryption | Prod / Staging | Head of Security | AWS KMS / Secrets Manager | Annual |
| `STRIPE_SECRET_KEY` | Stripe billing API private secret key for checkout & subscription management | Prod / Staging | Finance / Tech Lead | AWS Secrets Manager (`fieldops/prod/stripe`) | 90 days |
| `STRIPE_WEBHOOK_SECRET` | HMAC-SHA256 signing secret for verifying incoming Stripe webhooks | Prod / Staging | Tech Lead | AWS Secrets Manager (`fieldops/prod/stripe-wh`) | 90 days |
| `FCM_PRIVATE_KEY` | Firebase Admin SDK private key for Android push notifications | Prod / Staging | Mobile Lead | AWS Secrets Manager (`fieldops/prod/fcm`) | 180 days |
| `APNS_AUTH_KEY` (`.p8`) | Apple Push Notification service token authentication key | Prod / Staging | Mobile Lead | AWS Secrets Manager (`fieldops/prod/apns`) | Annual |
| `SMTP_PASS` / SendGrid API | Transactional email delivery API credentials | Prod / Staging | SRE Lead | AWS Secrets Manager (`fieldops/prod/smtp`) | 180 days |
| `SENTRY_AUTH_TOKEN` | Sentry source map upload and release creation token | CI / CD | DevOps Lead | GitHub Actions Secret | 90 days |
| `MOBILE_ANDROID_KEYSTORE` | Android App Bundle production release signing keystore & password | Prod Mobile | Mobile Lead | AWS Secrets Manager (`fieldops/prod/android-keystore`) | Annual |
| `MOBILE_IOS_CERTIFICATE` | Apple App Store Distribution certificate and provisioning profile | Prod Mobile | Mobile Lead | AWS Secrets Manager (`fieldops/prod/ios-cert`) | Annual |

---

## 2. General Zero-Downtime Secret Rotation Procedure

All high-availability secrets support overlapping or dual-key rotation:

```
[Generate New Secret] ──► [Deploy Dual-Accept Verification] ──► [Cut Over Active Emitter] ──► [Revoke Deprecated Secret]
```

### 2.1 Database Credential Rotation
1. **Create New User/Role in PostgreSQL**:
   ```sql
   CREATE ROLE fieldops_app_v2 WITH LOGIN PASSWORD 'secure_generated_pass';
   GRANT fieldops_app TO fieldops_app_v2;
   ```
2. **Update Application Secrets**:
   Update `DATABASE_URL` in AWS Secrets Manager to `fieldops_app_v2`.
3. **Trigger Rolling Restart**:
   Perform zero-downtime rolling restart of web application instances (`apps/web`). Existing connections drain naturally.
4. **Deprecate Old Role**:
   After 24 hours of zero connections, drop or lock `fieldops_app_v1`:
   ```sql
   ALTER ROLE fieldops_app_v1 NOLOGIN;
   ```

### 2.2 Stripe Webhook Signing Secret Rotation
1. In Stripe Dashboard $\to$ Developers $\to$ Webhooks, navigate to the production endpoint (`https://app.fieldops.com/api/v1/billing/webhook`).
2. Click **Rotate Signing Secret**. Stripe provides a 24-hour expiration window during which **both** old and new secrets are valid.
3. Update `STRIPE_WEBHOOK_SECRET` in AWS Secrets Manager.
4. Trigger web application deployment. Verify that incoming events continue to succeed.
5. In Stripe Dashboard, click **Expire Old Secret Now** once rolling restart completes.

### 2.3 Supabase Service Role Key Rotation
1. Generate new service role secret via Supabase Management API or project settings.
2. Update `SUPABASE_SERVICE_ROLE_KEY` in AWS Secrets Manager.
3. Deploy updated environment variables to edge workers and web application.
4. Verify smoke tests: `pnpm tsx scripts/post-deployment-verification.ts`.
5. Revoke previous service role key in Supabase settings.

---

## 3. Emergency Secret Rotation Protocol (Breach / Leak)

If a production secret is suspected of exposure:

1. **Declare Incident (SEV-0 / SEV-1)**: Follow the [Incident Response Playbook](file:///workspace/clever-darwin/docs/operations/incident-response.md).
2. **Immediate Revocation**:
   - For compromised third-party API keys (Stripe, SendGrid, Sentry): Revoke immediately in provider console.
   - For database credentials: Kill existing sessions for compromised user (`pg_terminate_backend(pid)`) and alter password immediately.
3. **Inject Replacement Secrets**:
   - Push updated secret from Vault / AWS Secrets Manager to production instances.
   - Force synchronous container redeploy.
4. **Audit Log Inspection**:
   - Query `audit_logs` and provider access logs for the period between suspected compromise and revocation to determine if data was accessed or exfiltrated.
5. **Post-Mortem**: Document root cause, affected blast radius, and preventative controls within 72 hours.

---

## 4. Verification Check

Before every production release, CI/CD executes automated static analysis to confirm no private keys, passwords, or service-role tokens exist in client-accessible bundles:
- Test: `tests/security/secret-exposure.test.ts` (PASS).
- Config Guard: `packages/config/src/index.ts` enforces `isBrowser()` runtime check on `loadServerConfig`.
