# Customer Support Operations & Escalation Runbook — FieldOps SaaS

| Document Version | 1.0.0 |
| :--- | :--- |
| **Phase** | **Phase 10 — Production Launch & Operations** |
| **Primary Channel** | `support@fieldops.com` / In-App Support Widget |
| **Standard Support Hours** | **Monday – Friday: 08:00 – 20:00 UTC** (Paid tiers: 24/7 for SEV-1) |

---

## 1. Support Severity Classification & Target Response Times

| Severity Level | Definition & Operational Impact | Target First Response | Target Resolution | Escalation Contact |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1 (Urgent Outage)** | Complete service unavailability, mobile sync failure across organization, data corruption, or security incident. | **$< 30\text{ minutes}$** | $< 4\text{ hours}$ | SRE Lead + Incident Commander |
| **SEV-2 (High Impact)** | Critical business workflow blocked (e.g., cannot clock-in shift, geofence check-in failing, checkout failing) with no workaround. | **$< 2\text{ hours}$** | $< 12\text{ hours}$ | Engineering Squad Lead |
| **SEV-3 (Normal)** | Non-blocking bug, UI glitch, CSV export slow, single user login issue with known workaround. | **$< 8\text{ business hours}$** | $< 3\text{ business days}$ | Tier-2 Support Engineer |
| **SEV-4 (Low / Question)** | How-to inquiry, general product feedback, account configuration question, feature inquiry. | **$< 24\text{ business hours}$** | Scheduled sprint review | Tier-1 Support Specialist |

---

## 2. Customer Support Ingestion & Ticketing Workflow

```
[In-App Widget / Email: support@fieldops.com]
                       │
                       ▼
[Tier-1 Support Specialist Triage] ────► [Self-Serve Knowledge Base / Config Help]
                       │ (Unresolved Technical Issue)
                       ▼
[Tier-2 Engineering Support] ──────────► [Reproduce Bug in Staging / Diagnostic Analysis]
                       │ (Platform Defect or SEV-1 Outage)
                       ▼
[Incident Commander & Squad Lead] ─────► [Activate Incident Response Playbook]
```

---

## 3. Customer Data Access & Least-Privilege Rules

To preserve multi-tenant privacy, support engineers must **never casually inspect customer tenant data**:

1. **No Production Database Browsing**: Support engineers are forbidden from executing ad-hoc queries against customer production tables (`tasks`, `visits`, `attendance_records`, `visit_proofs`).
2. **Explicit Customer Consent (Impersonation Token)**:
   - If troubleshooting requires inspecting a customer workspace, the organization Owner must explicitly grant temporary support access via Settings $\to$ Security $\to$ "Allow FieldOps Support Access (24 Hours)".
   - This generates a time-bounded, audited support token logged in `audit_logs`.
3. **Redacted Telemetry**: Sentry error logs and application traces automatically sanitize customer names, passwords, GPS coordinates, and payment details.
4. **Audit Trail**: Every access attempt by an operator or support engineer is permanently recorded with user ID, timestamp, and target tenant ID.

---

## 4. Supportable Error Messages & Correlation IDs

When a user encounters an unexpected failure, FieldOps displays a human-readable message accompanied by a unique Correlation Reference ID:

```
"We couldn't complete this action.
Please try again.
Reference: REQ-8F92A1"
```

### Support Procedure:
1. Customer provides `REQ-8F92A1`.
2. Support engineer queries Sentry / Datadog APM for `tags.request_id: REQ-8F92A1`.
3. Engineer inspects exact server-side error without exposing stack traces or internals to the customer.

---

## 5. Escalation Contacts & Channels

- **Support War Room (Slack)**: `#support-tier2-escalation`
- **On-Call Pager (PagerDuty)**: `fieldops-prod-oncall`
- **Security Escalations**: `security@fieldops.com`
- **Billing Inquiries & Disputes**: `billing@fieldops.com`
