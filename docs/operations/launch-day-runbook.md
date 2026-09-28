# Launch Day Runbook — FieldOps SaaS (First 24 Hours)

| Target Release | FieldOps v1.0.0 Production Launch |
| :--- | :--- |
| **Launch Window** | **06:00 – 10:00 UTC (Tuesday)** |
| **Incident War Room** | `#launch-war-room` (Slack) / Huddle: `https://meet.fieldops.com/launch` |
| **Incident Commander** | VP of Engineering |
| **Lead DBA / SRE** | Production Operations Lead |

---

## 1. Timeline & Checklist

```
[T-24h: Pre-Flight] ──► [T-2h: Final Backup] ──► [T-0: Deploy & Migrate] ──► [T+30m: Smoke Test]
                                                                                      │
                                                                                      ▼
[T+24h: Day 1 Review] ◄── [T+4h: Broad Launch] ◄── [T+1h: Pilot Cohort Activation] ◄──┘
```

### 1.1 Phase 1: Pre-Flight Verification (T-24h to T-2h)
- [ ] **Code Freeze Declared**: Master branch locked; only launch-critical P0 hotfixes permitted.
- [ ] **Automated CI Validation**:
  - `pnpm turbo run typecheck` (11/11 passing).
  - `pnpm vitest run` (54/54 test files, 380/380 tests passing).
  - `flutter test` (43/43 tests passing).
- [ ] **Production Infrastructure Verified**:
  - PostgreSQL RDS/Supabase primary instance running with connection pooler enabled.
  - S3 / Supabase storage bucket `fieldops-media` RLS active with 15MB file ceiling.
  - Stripe live mode credentials validated via Secrets Manager.
  - Sentry project initialized with release tag `v1.0.0`.
- [ ] **Pre-Launch Database Snapshot**:
  - Execute manual WAL archive & base snapshot before applying migrations:
    ```bash
    aws rds create-db-snapshot --db-instance-identifier fieldops-prod-db --db-snapshot-identifier pre-launch-v1-0-0
    ```

### 1.2 Phase 2: Deployment & Cutover (T-0 to T+30m)
- [ ] **Apply Production Database Migrations**:
  - Run `supabase db push` or migration runner sequentially through `000009_storage_security_and_hardening.sql`.
  - Validate schema integrity:
    ```bash
    npx tsx scripts/verify-data-integrity.ts
    ```
- [ ] **Deploy Web Operations Console (`apps/web`)**:
  - Deploy Next.js production build to edge hosting with production environment variables.
  - Verify `/api/health/live` returns HTTP 200 OK.
  - Verify `/api/health/ready` returns HTTP 200 OK.
- [ ] **Execute Automated Production Smoke Suite**:
  ```bash
  npx tsx scripts/production-smoke-test.ts
  ```
  - *Gate Condition*: All 11 assertions must report `PASS` before proceeding.

### 1.3 Phase 3: Pilot Customer Activation (T+30m to T+4h)
- [ ] **Activate Internal Beta Organization**: Log into internal testing organization; perform a live end-to-end field dispatch workflow:
  - Create task $\to$ dispatch visit $\to$ clock in shift $\to$ mobile GPS check-in $\to$ proof photo capture $\to$ task completion $\to$ CSV export.
- [ ] **Onboard Pilot Customer Cohort (3 Enterprises)**:
  - Invite initial pilot customer administrators.
  - Assist pilot dispatchers with team roster and geofenced location creation.
- [ ] **Observe Early Traffic in War Room**:
  - Monitor Datadog APM request rate and p95 latency ($< 150\text{ms}$).
  - Monitor Sentry error stream: zero unhandled 5xx exceptions.
  - Monitor Stripe webhook event log: all events returning HTTP 200 with verified signatures.

### 1.4 Phase 4: General Availability & Mobile Staged Rollout (T+4h to T+24h)
- [ ] **Publish Mobile Releases**:
  - Google Play: Release `v1.0.0` at 10% staged rollout.
  - Apple App Store: Phased release activated (Day 1: 1%–5%).
- [ ] **Publish Public Launch Announcement**:
  - Update status page to `Operational` at `https://status.fieldops.com`.
  - Open public signup for web operations consoles at `https://app.fieldops.com/signup`.

---

## 2. Real-Time Telemetry & Monitoring Matrix

| Subsystem | Metric | Warning Threshold | Critical Alarm (Trigger Rollback Review) |
| :--- | :--- | :--- | :--- |
| **Web Console** | HTTP 5xx Error Rate | $> 0.2\%$ | $> 1.0\%$ |
| **API Latency** | p95 Response Time | $> 250\text{ms}$ | $> 1000\text{ms}$ |
| **Mobile Sync** | Mutation Queue Failure Rate | $> 0.5\%$ | $> 2.0\%$ |
| **Database** | Connection Pool Saturation | $> 70\%$ | $> 90\%$ |
| **SaaS Billing** | Webhook Processing Error | $\ge 1$ unhandled failure | $\ge 5$ consecutive failures |
| **Storage** | Proof Upload Failure Rate | $> 1.0\%$ | $> 5.0\%$ |

---

## 3. Emergency Abort & Rollback Criteria

The Incident Commander will immediately halt the launch and activate the [Rollback Runbook](file:///workspace/clever-darwin/docs/operations/rollback-runbook.md) if:
1. Cross-tenant data leakage occurs (SEV-0).
2. Database migration fails or locks tables unexpectedly.
3. Mobile sync engine corrupts local SQLite stores.
4. Billing webhook processor drops or incorrectly mutates subscription records.
5. Overall API error rate exceeds $2.0\%$ for $> 5\text{ minutes}$.
