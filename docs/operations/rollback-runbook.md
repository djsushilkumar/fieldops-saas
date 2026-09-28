# Rollback Runbook — FieldOps SaaS

| Document Version | 1.0.0 |
| :--- | :--- |
| **Phase** | **Phase 10 — Production Launch & Operations** |
| **Trigger Authority** | **Incident Commander (VP of Engineering / Lead SRE)** |
| **Target Execution Time** | **$< 10\text{ minutes}$ for Web; $< 30\text{ minutes}$ for Database** |

---

## 1. Rollback Decision Matrix

| Failure Mode | Severity | Rollback Strategy | Estimated Recovery Time |
| :--- | :--- | :--- | :--- |
| **Web Frontend Critical Bug / 5xx Spike** | SEV-1 | Instant DNS / Edge deployment rollback to prior container image | $< 3\text{ minutes}$ |
| **Faulty Database Migration (Non-Destructive)**| SEV-1 | Execute reversible `down` migration SQL script | $< 5\text{ minutes}$ |
| **Corrupted Database Records / Data Purge** | SEV-0 | Point-in-Time Recovery (PITR) to pre-deployment timestamp | $< 25\text{ minutes}$ |
| **Mobile App Client Crash Spike ($> 1\%$)** | SEV-1 | Halt staged rollout in Google Play / App Store; activate feature flag gate | $< 10\text{ minutes}$ |
| **Billing Webhook Ingestion Malfunction** | SEV-1 | Pause webhook consumer; replay queued events from Stripe buffer | $< 15\text{ minutes}$ |

---

## 2. Step-by-Step Rollback Procedures

### 2.1 Web Application Rollback (`apps/web`)

1. **Identify Previous Stable Release SHA**:
   ```bash
   git log --oneline -n 5
   # Example: df8d2c6 (Previous stable release)
   ```
2. **Execute Deployment Revert**:
   - In Hosting Provider (Vercel / AWS ECS / Kubernetes):
     ```bash
     # If Kubernetes / ECS:
     kubectl rollout undo deployment/fieldops-web --to-revision=PREVIOUS_REVISION
     
     # If Vercel CLI:
     vercel rollback [DEPLOYMENT_URL] --token $VERCEL_TOKEN
     ```
3. **Verify Liveness & Readiness**:
   ```bash
   curl -f https://app.fieldops.com/api/health/live
   curl -f https://app.fieldops.com/api/health/ready
   ```

### 2.2 Database Rollback & Schema Reversal

FieldOps migrations are designed using the **Expand-and-Contract** pattern, making schema rollbacks non-destructive:

1. **Identify Migration Version**:
   - Determine which migration introduced the defect (e.g., `20260928000009`).
2. **Execute Schema Reversal**:
   - If the migration is reversible via DDL:
     ```sql
     -- Example: Revert storage hardening bucket constraints if causing lock contention
     DROP POLICY IF EXISTS "tenant_isolation_storage" ON storage.objects;
     ```
3. **If Data Corruption Occurred (Point-in-Time Recovery)**:
   - Follow the [Disaster Recovery Plan](file:///workspace/clever-darwin/docs/operations/disaster-recovery.md):
     - Restore PostgreSQL database to snapshot timestamp $T_{-5\text{min}}$ prior to migration.
     - Replay WAL logs up to the exact pre-migration timestamp.
     - Verify tenant isolation: `npx tsx scripts/verify-data-integrity.ts`.

### 2.3 Feature Flag Disablement

If a defect is isolated to a specific operational module:
1. Set the module's feature flag to `false` in production environment secrets / configuration:
   - `ENABLE_BILLING_PORTAL=false`
   - `ENABLE_REPORT_EXPORTS=false`
   - `ENABLE_REALTIME_MAP=false`
2. Restart edge workers. The client UI will gracefully display "Feature temporarily in maintenance" while core dispatch and attendance remain fully functional.

### 2.4 Mobile App Mitigation

Because native mobile apps cannot be rolled back instantly on user devices:
1. **Halt Staged Rollout**:
   - In Google Play Console: Navigate to **Production $\to$ Releases $\to$ Halt rollout**.
   - In App Store Connect: Navigate to **Phased Release $\to$ Pause**.
2. **Backend Compatibility Shield**:
   - If the bug is caused by a new API response field, deploy a backend patch that tolerates older request schemas and suppresses the problematic response payload.
3. **Emergency Hotfix Release**:
   - Build hotfix with patch version increment (`1.0.1`), bypass standard phased release, and request an Expedited Review from Apple and Google.

### 2.5 Billing Webhook Mitigation

1. If Stripe webhook processing is failing:
   - Temporarily disable the webhook endpoint in Stripe Dashboard.
   - **No Data Loss**: Stripe automatically queues and retries undelivered webhook events for up to 72 hours.
   - Fix the signature or parsing bug, redeploy web application, and click **Resend Failed Events** in Stripe.

---

## 3. Post-Rollback Verification & Communication

1. **Run Smoke Test**:
   ```bash
   npx tsx scripts/production-smoke-test.ts
   ```
2. **Confirm Error Rates Normalized**: Verify Sentry error rates drop back below $0.1\%$.
3. **Update Status Page**: Update `https://status.fieldops.com` with a brief, transparent incident summary:
   *"The scheduled release encountered an anomaly and was successfully rolled back. All operational services are operating normally."*
4. **Mandatory Post-Mortem**: Schedule a blameless post-mortem within 48 hours per the [Incident Response Playbook](file:///workspace/clever-darwin/docs/operations/incident-response.md).
