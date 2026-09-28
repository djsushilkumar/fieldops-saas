# Disaster Recovery Plan — FieldOps SaaS

## 1. Objectives & Metrics

| Metric | Target | Rationale |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **$\le$ 5 minutes** | PostgreSQL continuous WAL archiving to S3/Cloud Storage guarantees maximum 5 minutes of data loss under complete infrastructure destruction. |
| **Recovery Time Objective (RTO)** | **$\le$ 30 minutes** | Standby database promotion takes $< 3\text{ min}$; cold PITR restore from point-in-time takes $< 20\text{ min}$; DNS cutover takes $< 5\text{ min}$. |
| **Integrity Objective** | **100% tenant isolation** | No recovery or failover procedure may bypass Row-Level Security (RLS) or restore data without multi-tenant boundaries intact. |

---

## 2. Disaster Scenarios & Failover Matrix

| Scenario | Severity | Primary Trigger | Recovery Action | Target Recovery |
| :--- | :--- | :--- | :--- | :--- |
| **Primary DB Hardware Failure** | SEV-1 | PostgreSQL unresponsive $> 90\text{s}$ | Automatic / manual read-replica promotion | RTO: 3 min, RPO: $< 10\text{s}$ |
| **Total Cloud Region Outage** | SEV-0 | Multi-AZ AWS/GCP region down | Regional failover: standby DB promotion, DNS cutover to secondary edge | RTO: 25 min, RPO: $< 5\text{min}$ |
| **Data Corruption / Malicious Purge**| SEV-1 | Erroneous migration or malicious query | Point-in-Time Recovery (PITR) to timestamp $T_{-1\text{min}}$ before event | RTO: 20 min, RPO: 0 min (up to event) |
| **Object Storage Outage** | SEV-2 | Supabase Storage bucket inaccessible | Read-through fallback to secondary geo-replicated bucket | RTO: 10 min, RPO: $< 1\text{min}$ |
| **DNS / CDN Failure** | SEV-1 | Primary Edge DNS / CDN unreachable | Anycast DNS switch from Cloudflare to AWS Route53 secondary | RTO: 5 min, RPO: 0 |

---

## 3. Step-by-Step Recovery Procedures

### 3.1 Scenario A: Standby Database Replica Promotion (Fast Failover)

1. **Declare Disaster**: Lead SRE verifies primary instance is unreachable for $> 90\text{s}$ and alerts Incident Commander.
2. **Promote Read Replica**:
   ```bash
   # If managed Supabase: trigger standby promotion via CLI / API
   supabase db failover --project-ref $PRIMARY_PROJECT_REF
   
   # If self-hosted PostgreSQL: promote standby
   pg_ctl promote -D /var/lib/postgresql/data
   ```
3. **Update Connection Secrets**:
   - Update `DATABASE_URL` and `DIRECT_URL` in Vault / AWS Secrets Manager.
   - Force rolling restart of Web (`apps/web`) and Edge functions to establish new pool connections.
4. **Run Smoke Verification**:
   ```bash
   pnpm tsx scripts/post-deployment-verification.ts
   ```

### 3.2 Scenario B: Point-in-Time Recovery (PITR) from WAL Backups

1. **Identify Target Timestamp**:
   - Query `audit_logs` to determine exact timestamp of corruption (e.g., `2026-09-28T18:42:15Z`).
   - Set target restore timestamp to 10 seconds before event: `2026-09-28T18:42:05Z`.
2. **Launch New PostgreSQL Target Instance**:
   - Provision fresh instance with matching compute and storage specifications.
3. **Execute Base Backup + WAL Replay**:
   ```bash
   # Restore base snapshot
   aws s3 cp s3://fieldops-backups-wal/base-snapshots/latest.tar.gz - | tar -xz -C /var/lib/postgresql/data
   
   # Configure recovery target in recovery.signal / postgresql.conf
   cat <<EOF >> /var/lib/postgresql/data/postgresql.conf
   restore_command = 'aws s3 cp s3://fieldops-backups-wal/wal/%f %p'
   recovery_target_time = '2026-09-28 18:42:05 UTC'
   recovery_target_action = 'promote'
   EOF
   
   touch /var/lib/postgresql/data/recovery.signal
   systemctl start postgresql
   ```
4. **Validate Schema & Multi-Tenant Boundaries**:
   ```bash
   pnpm tsx scripts/verify-data-integrity.ts
   ```
5. **Update Application Secrets**:
   - Rotate database password and update application cluster environment secrets.

### 3.3 Scenario C: Object Storage Recovery (`fieldops-media`)

1. **Verify Bucket State**:
   - Check if primary bucket `fieldops-media` has corrupted or deleted objects.
2. **Replicate from Geo-Secondary S3 / Cloud Storage**:
   ```bash
   aws s3 sync s3://fieldops-media-secondary/ s3://fieldops-media-primary/ \
     --sse aws:kms \
     --sse-kms-key-id $KMS_KEY_ID
   ```
3. **Verify Bucket RLS Policies**:
   - Re-run `supabase/migrations/20260928000009_storage_security_and_hardening.sql` to guarantee object-level RLS policies are active:
     - Multi-tenant tenant ID isolation: `(storage.foldername(name))[1] = current_tenant_id()::text`.
     - File size limit: 15MB.
     - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `image/svg+xml`.

### 3.4 Scenario D: Edge & DNS Cutover

1. **TTL Configuration**: Production DNS A/AAAA records for `api.fieldops.com` and `app.fieldops.com` are kept at TTL 60 seconds.
2. **Execute Cutover**:
   ```bash
   # Switch DNS routing to standby origin
   cloudflare-cli dns-records update --zone fieldops.com --name app --content $SECONDARY_ORIGIN_IP --ttl 60
   ```
3. **Verify SSL Termination**:
   - Ensure wildcard TLS certificates (`*.fieldops.com`) are valid on the secondary edge.

---

## 4. Mobile Client Behavior During Outages

FieldOps mobile architecture is designed with offline-first local SQLite (Drift) resilience:
1. **Zero Data Loss on Network / Backend Failure**: Field workers continue clocking shifts, recording geofenced visits, capturing photos, and updating tasks.
2. **Offline Mutation Queue**: Mutations are stored locally with idempotency keys (`idempotency_key`), encrypted at rest via AES-256 SQLCipher.
3. **Exponential Backoff Reconnect**: Once the disaster recovery team re-establishes backend services, mobile clients drain their mutation queues chronologically without creating duplicate records or race conditions.
4. **Conflict Resolution**: Last-Write-Wins on mutable scalar fields; append-only invariant on audit logs and worker activity entries.

---

## 5. Communications & Roles

| Role | Responsibilities | Primary Contact |
| :--- | :--- | :--- |
| **Incident Commander (IC)** | Declares disaster, coordinates actions, approves failover decisions | VP of Engineering |
| **Database Lead (DBA/SRE)** | Executes database promotion, PITR restore, integrity checks | Lead SRE |
| **Security Officer** | Verifies multi-tenant isolation, audit log integrity, rotates secrets | Head of Security |
| **Communications Lead** | Updates public status page (`status.fieldops.com`), notifies affected tenants | Customer Success Director |

---

## 6. Testing & Drill Cadence

1. **Bi-Annual Simulated Region Outage**: Full tabletop and staging failover drill every 6 months.
2. **Monthly Automated PITR Verification**: Dedicated staging pipeline automatically restores random daily WAL archives into an ephemeral DB and executes `scripts/verify-data-integrity.ts`.
3. **Drill Log & Post-Mortem**: Every simulated or real drill produces an action item review within 48 hours.
