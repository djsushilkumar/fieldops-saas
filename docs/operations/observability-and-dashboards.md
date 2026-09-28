# Production Observability, Dashboards & Alerting Architecture — FieldOps SaaS

| Document Version | 1.0.0 |
| :--- | :--- |
| **Phase** | **Phase 10 — Production Launch & Operations** |
| **Telemetry Stack** | **Datadog APM + Sentry Error Monitoring + Supabase Metrics** |
| **Target Availability** | **99.9% Uptime across Web & Mobile Sync Endpoints** |

---

## 1. Production Dashboard Layouts

FieldOps maintains five specialized operational dashboards in Datadog / Grafana:

### 1.1 Dashboard 1: Web Application & API Gateway
- **Request Volume**: Total requests/sec partitioned by HTTP verb and endpoint group (`/api/v1/tasks`, `/api/v1/visits`, `/api/v1/attendance`).
- **Error Rates**: 4xx client errors vs. 5xx server errors (Alert on 5xx $> 0.1\%$).
- **Latency Distribution**: p50, p90, p95, and p99 response times (Target: p95 $< 150\text{ms}$).
- **Active Realtime Connections**: Concurrent Supabase WebSocket channels partitioned by tenant.

### 1.2 Dashboard 2: PostgreSQL Database & Connection Pooling
- **Connection Saturation**: Active client connections vs. pgBouncer pool limits (Alert at $> 80\%$).
- **CPU & Memory Utilization**: Primary database node CPU load (Alert at $> 75\%$ sustained 5m).
- **Disk I/O & Storage Growth**: Free storage space and write IOPS headroom.
- **Top Slow Queries**: Query execution latency tracked via `pg_stat_statements`.

### 1.3 Dashboard 3: Mobile Workforce & Offline Sync Health
- **Crash-Free Sessions**: Rolling 24-hour crash-free user rate (Target: $\ge 99.8\%$).
- **Sync Queue Processing**: Number of queued mutations drained/sec and average sync latency.
- **Sync Failure Spikes**: Idempotency conflicts, authentication expiry during sync, payload validation rejections.
- **Offline Batch Distribution**: Percentage of mutations executed offline vs. connected.

### 1.4 Dashboard 4: SaaS Billing & Subscription Webhooks
- **Stripe Webhook Delivery**: Total events received vs. successfully processed (Target: $100\%$).
- **Webhook Ingestion Latency**: Time from Stripe event timestamp to internal subscription state update ($< 2\text{s}$).
- **Checkout Conversions**: Successful checkout sessions vs. abandoned sessions.
- **Quota Exceeded Events**: Counter of organizations reaching task, worker, or storage tier ceilings.

### 1.5 Dashboard 5: Infrastructure & Third-Party Dependencies
- **Supabase Storage Health**: Media upload/download throughput and 15MB ceiling rejection counts.
- **Map Tile API Consumption**: Daily request count against OpenStreetMap / Mapbox quotas.
- **Push Notification Latency**: FCM / APNS dispatch latency and delivery receipts.
- **Transactional Email Deliverability**: SendGrid bounce rate and spam complaint rate ($< 0.05\%$).

---

## 2. Alerting Matrix & Escalation Routing

Every alert is actionable and mapped directly to an on-call response runbook:

| Alert Name | Condition | Severity | Notification Channel | Response Action |
| :--- | :--- | :---: | :--- | :--- |
| `API_5XX_ELEVATED` | HTTP 5xx rate $> 0.5\%$ for 3 min | **SEV-1** | PagerDuty (SRE On-Call) + `#ops-alerts` | Inspect Sentry logs; execute [Rollback Runbook](file:///workspace/clever-darwin/docs/operations/rollback-runbook.md) if regression. |
| `DB_POOL_SATURATION` | Active connections $> 85\%$ for 2 min | **SEV-1** | PagerDuty (DBA On-Call) | Inspect connection leaks; scale pgBouncer worker pool. |
| `MOBILE_CRASH_SPIKE` | Crash-free sessions $< 99.0\%$ for 10 min | **SEV-1** | PagerDuty (Mobile Lead) | Halt mobile staged rollout in Google Play / App Store. |
| `STRIPE_WEBHOOK_FAILURE` | $\ge 2$ webhook errors in 5 min | **SEV-1** | Slack `#billing-alerts` + SMS | Check signature secret; pause webhook endpoint. |
| `SYNC_FAILURE_SPIKE` | Offline sync error rate $> 2\%$ | **SEV-2** | Slack `#mobile-alerts` | Inspect schema mismatch or auth token expiration bugs. |
| `STORAGE_UPLOAD_ERROR` | Media upload failure $> 3\%$ | **SEV-2** | Slack `#ops-alerts` | Check Supabase storage bucket status and RLS policies. |
| `API_LATENCY_DEGRADED`| p95 latency $> 500\text{ms}$ for 5 min | **SEV-2** | Slack `#ops-alerts` | Inspect database locks and slow queries in Datadog APM. |
| `AUTH_BRUTE_FORCE` | $> 50$ failed logins/min on single IP | **SEV-2** | Slack `#security-alerts` | Apply Cloudflare WAF IP rate limit rule. |

---

## 3. Synthetic Monitoring Probes

Datadog Synthetic Tests execute automated health checks every 60 seconds from 5 global locations:
1. `GET https://app.fieldops.com/api/health/live` $\to$ Expect HTTP 200 within $300\text{ms}$.
2. `GET https://app.fieldops.com/api/health/ready` $\to$ Expect HTTP 200 within $500\text{ms}$.
3. `POST https://app.fieldops.com/api/v1/auth/session` (Mock Probe) $\to$ Expect valid header check.
