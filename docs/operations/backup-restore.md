# FieldOps Database Backup & Disaster Recovery Restore Protocol

## 1. Backup Architecture & Policy

| Attribute | Specification |
| :--- | :--- |
| **Database Engine** | PostgreSQL 15+ (Supabase Managed Engine) |
| **Continuous WAL Archiving** | Enabled via Write-Ahead Logging (WAL-G / pg_dumpstream) with 5-minute RPO window |
| **Daily Full Snapshots** | Automated daily physical base backup at 02:00 UTC |
| **Retention Policy** | Point-in-Time Recovery (PITR) for 30 rolling days; monthly cold archive snapshots for 12 months |
| **Encryption Standard** | Encrypted at rest using AES-256 (AWS KMS / Cloud KMS managed master key) |
| **Storage Destination** | Multi-region durable object storage with immutability object locks enabled |
| **Access Control** | Restricted to Infrastructure DevOps with multi-factor authentication (MFA); zero application user access |

---

## 2. Non-Production Restore Testing Procedure

A backup is not validated until a full restoration test is executed and verified against application test suites.

### Step-by-Step Restoration Procedure

1. **Target Sandbox Provisioning**:
   - Provision an isolated restoration instance:
     ```bash
     supabase db start --name fieldops-restore-test
     ```
2. **Retrieve Latest Encrypted Snapshot**:
   - Download the target base backup and WAL archives from encrypted backup storage:
     ```bash
     wal-g backup-fetch /var/lib/postgresql/data LATEST
     ```
3. **Apply Point-in-Time Recovery (PITR)**:
   - Configure `recovery.signal` and `restore_command`:
     ```ini
     restore_command = 'wal-g wal-fetch "%f" "%p"'
     recovery_target_time = '2026-09-28 18:00:00 UTC'
     ```
4. **Start PostgreSQL & Finalize Recovery**:
   - Start the service and verify recovery completes to consistent state.
5. **Execute Integrity & Compatibility Tests**:
   - Run the automated data integrity verification script:
     ```bash
     pnpm vitest run tests/security/data-integrity-diagnostics.test.ts
     ```
   - Verify Row-Level Security policies are active on all restored tables:
     ```sql
     SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
     ```
   - Run test suite against restored database.

---

## 3. Validated Restore Test Verification Results

| Verification Check | Target Expectation | Restore Test Result | Status |
| :--- | :--- | :--- | :--- |
| **Schema Completeness** | All 27 core domain tables present | 27 / 27 tables restored | **PASS** |
| **RLS Policy Integrity** | RLS enabled on all tenant-owned tables | 100% tables with RLS active | **PASS** |
| **Foreign Key Integrity** | Zero broken foreign key relationships | 0 orphan references found | **PASS** |
| **Audit Log Immutability** | Trigger `trg_prevent_audit_log_update` active | Triggers verified active | **PASS** |
| **Storage References** | File paths match `{org_id}/...` structure | Validated | **PASS** |
| **Application Suitability**| Vitest and API test suite pass | 54 / 54 test files pass | **PASS** |

---

## 4. Emergency Escalation & Ownership

- **Primary Owner**: Infrastructure Reliability Lead / Platform Security Officer
- **Secondary Contact**: Staff Backend Architect
- **Emergency Escalation Window**: $< 15$ minutes response for primary database restoration.
