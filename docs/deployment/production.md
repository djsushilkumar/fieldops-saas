# FieldOps — Production Deployment & Release Runbook

---

## 1. Production Architecture Overview

The production environment operates as a high-availability, multi-tenant cloud service:
- **Compute**: Stateless auto-scaling container clusters (Web & API services).
- **Database**: Managed PostgreSQL 15+ cluster with automated point-in-time recovery (PITR) and synchronous read-replicas.
- **Object Storage**: S3-compatible cloud storage with multi-AZ replication.
- **Edge**: Cloudflare / CDN edge proxy for TLS 1.3 termination, DDoS protection, and static asset caching.

---

## 2. Production Release Gates

Production deployments require:
1. Gated approval by Engineering Lead.
2. Verified completion of all CI checks and staging smoke tests.
3. Database backup snapshot taken prior to applying forward migrations.
4. Active SLA and error rate monitoring on Datadog/Sentry during rollout.
