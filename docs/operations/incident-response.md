# Incident Response Playbook — FieldOps SaaS

## 1. Severity Classification Matrix

| Severity | Definition | Target Response | Communication Cadence | Escalation Contacts |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-0 (Critical Emergency)** | Active tenant data breach, multi-tenant isolation failure, catastrophic data loss, or total production outage across all tenants. | $< 15\text{ minutes}$ | Every 30 minutes | Incident Commander, VP Eng, CTO, Legal Counsel |
| **SEV-1 (High Impact)** | Major platform degradation (e.g. shift clock-in completely down, geofence verification broken, billing webhook processing failure) affecting $> 10\%$ of tenants. | $< 30\text{ minutes}$ | Every 60 minutes | Incident Commander, Tech Lead, SRE On-call |
| **SEV-2 (Medium Impact)** | Isolated component failure (e.g., CSV export timeout, non-critical web view error, single tenant affected) with available workaround. | $< 2\text{ hours}$ | Every 4 hours | Product Engineering Lead |
| **SEV-3 (Low / Minor)** | Cosmetic defect, minor UI glitch, non-blocking edge-case error. | $< 24\text{ hours}$ | Next business day | Assigned Squad Engineer |

---

## 2. Standard Incident Lifecycle

```
[Detection & Alerting]
         │
         ▼
[Triage & Declaration] ────► [War Room Assembled (IC, Tech Lead, Comms)]
         │
         ▼
[Containment & Mitigation] ─► [Prevent Lateral Spread / Restore Primary Flow]
         │
         ▼
[Eradication & Recovery] ──► [Deploy Verified Fix / Run Integrity Diagnostics]
         │
         ▼
[Post-Incident Review] ────► [Blameless Post-Mortem within 72 Hours]
```

### 2.1 Stage 1: Detection & Alerting
Incidents are detected via:
- Automated Sentry error spike alerts ($> 1\%$ 5xx rate on API).
- Datadog synthetic monitors on health checks (`/api/health`).
- Webhook signature or payment processing failure alarms.
- Daily `scripts/verify-data-integrity.ts` anomaly alerts.
- Customer support ticket escalations.

### 2.2 Stage 2: Triage & Incident Declaration
1. The on-call engineer assesses impact against the Severity Matrix.
2. If SEV-0 or SEV-1, immediately declare the incident in the `#incident-response` channel:
   ```
   🚨 INCIDENT DECLARED: SEV-0 / SEV-1
   Description: [Summary of defect]
   Incident Commander: [@IC]
   Tech Lead: [@TechLead]
   War Room: [Video link]
   Status Page: https://status.fieldops.com
   ```

### 2.3 Stage 3: Containment & Mitigation
Prioritize immediate harm prevention over immediate root cause debugging:
- **Tenant Isolation Breach**:
  - Immediately revoke session tokens for compromised tenant.
  - Apply temporary IP block / user quarantine.
  - Disable affected API endpoint via feature flag (`ENABLE_ENDPOINT=false`).
- **Data Corruption Event**:
  - Place database in read-only mode if necessary (`ALTER DEFAULT PRIVILEGES REVOKE INSERT, UPDATE...`).
  - Initiate Point-in-Time Recovery (PITR) per [Disaster Recovery Plan](file:///workspace/clever-darwin/docs/operations/disaster-recovery.md).
- **Billing Webhook Ingestion Anomaly**:
  - Pause webhook processing queue; events remain securely queued with provider (Stripe/Razorpay) up to 72 hours.

### 2.4 Stage 4: Eradication & Recovery
- Develop hotfix following strict phase-gate rules (AGENTS.md).
- Add automated regression test replicating the failure pattern in `tests/security/` or unit tests.
- Verify test passes locally (`pnpm typecheck`, `pnpm vitest run`, `flutter test`).
- Deploy fix via standard CI/CD pipeline (no unverified manual DB hacks).
- Run `scripts/post-deployment-verification.ts` and `scripts/verify-data-integrity.ts`.

### 2.5 Stage 5: Post-Incident Review & Accountability
- Host a blameless post-mortem meeting within 72 hours.
- Required post-mortem document structure:
  1. Incident Summary & Timeline (T0 detection to T_final resolution).
  2. Impact Assessment (tenants affected, records altered, downtime minutes).
  3. Root Cause Analysis (5 Whys methodology).
  4. Corrective and Preventive Actions (CAPA) with assigned owners and due dates.
  5. Artifact committed to `docs/operations/post-mortems/YYYY-MM-DD-<incident-slug>.md`.

---

## 3. Tabletop Scenario: Cross-Tenant Data Leak Alert

| Step | Action | Responsible Role | Verification Method |
| :--- | :--- | :--- | :--- |
| **T+0m** | Alert fires: `IDOR_RESOURCE_ACCESS_VIOLATION` logged in Sentry for `/api/tasks`. | Monitoring Bot | Sentry incident notification |
| **T+3m** | SRE on-call verifies user from Tenant A attempted query for `task_id` belonging to Tenant B. | SRE On-call | Audit log query (`select * from audit_logs where action = 'PERMISSION_DENIED'`) |
| **T+5m** | Verify RLS behavior: Confirm whether PostgreSQL RLS rejected the query (HTTP 403 / empty set) or if data was returned. | Security Lead | Test harness execution (`tests/security/idor-resource-access.test.ts`) |
| **T+8m** | If RLS blocked the query (defense in depth worked): Incident classified as SEV-2 intrusion attempt. Actor IP quarantined. | Security Lead | WAF IP block rule applied |
| **T+10m** | If RLS failed and data leaked: Incident escalated to **SEV-0**. IC triggers containment, revokes tokens, notifies Legal. | IC & Legal Lead | Session table invalidation |
| **T+25m** | Hotfix deployed with updated RLS policy and server-side tenant validation. | Tech Lead | Smoke test & security suite pass |
| **T+45m** | External disclosure to impacted tenant in compliance with GDPR Art. 33 / DPDP Act. | Legal / Comms | Customer notification delivered |

---

## 4. Operational Contacts & Roles

- **Incident Commander (IC)**: Rotates weekly among Engineering Leads.
- **Operations War Room**: Internal `#ops-war-room` on Slack.
- **Customer Status Channel**: Public status page at `status.fieldops.com`.
- **Security Escalation**: `security@fieldops.com`.
