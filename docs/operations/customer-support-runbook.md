# FieldOps Customer Support Runbook & Operational Troubleshooting Guide

| Document Version | `1.0.0-rc.1` |
| :--- | :--- |
| **Applicability** | FieldOps Tier-1, Tier-2, & SRE Support Personnel |
| **Target Build** | `1.0.0` (Web) / `1.0.0+1` (Mobile) |
| **Primary Ingestion** | `support@fieldops.com` / In-App Console Support |

---

## 1. Incident Severity & SLA Classification

| Severity Level | Definition | First Response SLA | Resolution SLA | Primary Responder |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1 (Critical Outage)** | Entire organization offline, mobile mutations unable to sync, data loss risk, or security/tenant breach. | **$< 30$ mins** | $< 4$ hours | On-Call SRE + Incident Commander |
| **SEV-2 (High Impact)** | Core workflow blocked for team (cannot clock in, visit check-in failing across devices, billing checkout down). | **$< 2$ hours** | $< 12$ hours | Tier-2 Engineering Squad |
| **SEV-3 (Normal Impact)** | Isolated technician issue (single device GPS failure, slow CSV export, UI glitch with workaround). | **$< 8$ hours** | $< 3$ business days | Tier-1 Support Specialist |
| **SEV-4 (Informational)** | How-to question, plan upgrade inquiry, feature suggestion. | **$< 24$ hours** | Sprint backlog | Customer Success Specialist |

---

## 2. Standard Support Response Procedure

1. **Intake & Triage**:
   - Extract Customer ID, Organization Slug, User Role, Device Model, OS Version, and Client App Version (`1.0.0+1`).
   - If user provides an error reference ID (`REQ-XXXXXX`), query Sentry / Datadog APM with `tags.request_id = "REQ-XXXXXX"`.
2. **Access Control & Privacy Boundaries**:
   - **Never request or record user passwords.**
   - **Never run raw SQL queries on production tables.**
   - If workspace inspection is required, request that the Organization Owner enable temporary 24-hour support access in `Settings -> Security`.
3. **Correlation & Diagnosis**:
   - Match reported symptom against the 8 troubleshooting domains below.
   - Collect client diagnostics via `Settings -> Diagnostics -> Share Diagnostic Log` in the mobile app.
4. **Resolution & Feedback**:
   - Provide clear, non-technical steps to the customer.
   - Log root cause, affected version, and resolution category in the support ticket.

---

## 3. Operational Troubleshooting Domains

### 3.1 Account Issues
- **Symptoms**: User cannot accept invitation link; user marked as inactive; user unable to access organization.
- **Diagnostic Steps**:
  1. Check `organization_memberships` table for target email.
  2. Verify membership status: `INVITED`, `ACTIVE`, `SUSPENDED`.
  3. Verify invitation expiration (tokens expire 7 days after issuance).
- **Resolution**:
  - If token expired: Admin/Manager must click "Resend Invitation" in `Organization -> Members`.
  - If user is in `SUSPENDED` status: Check audit log to verify if admin deactivated account due to departure or billing quota restrictions.
  - If user email mismatch: Ensure user signs up with the exact corporate email address receiving the invitation link.

### 3.2 Login Issues
- **Symptoms**: "Invalid credentials" error; infinite loading spinner on `/login`; magic link not received.
- **Diagnostic Steps**:
  1. Inspect Supabase Auth logs for `auth.users` entry matching target email.
  2. Verify if email confirmation is enabled and completed.
  3. Verify whether rate limiting has blocked IP / user after 5 failed attempts (HTTP 429).
- **Resolution**:
  - If rate-limited: Advise user to wait 15 minutes before re-attempting or trigger password reset.
  - If infinite loading spinner on mobile: Instruct user to force-close app, verify internet connectivity, and re-launch. Ensure mobile build is updated to `1.0.0+1`.
  - On web: Ensure browser is not blocking necessary session cookies (`sb-access-token`, `sb-refresh-token`).

### 3.3 Task Sync Issues
- **Symptoms**: Changes made on mobile not visible on web console; task marked "Pending Sync" indefinitely.
- **Diagnostic Steps**:
  1. In mobile app, navigate to `Settings -> Sync Status`. Check "Pending Mutations Count" and "Last Successful Sync Timestamp".
  2. Inspect whether the client is in Offline Mode or encountering HTTP 409 Conflict.
  3. Check Sentry for `SyncFailureException` or schema validation errors.
- **Resolution**:
  - If network is available: Tap "Force Sync Now" button on the Sync Status screen.
  - If mutation conflict occurred: Inform worker that a manager reassigned or updated the task concurrently. Explain that server-side state is authoritative and the task has refreshed to the latest state.
  - If sync remains blocked: Use "Export Sync Diagnostic File" and escalate to Tier-2 with the attached JSON log.

### 3.4 GPS & Geofence Issues
- **Symptoms**: "Outside Radius" alert when technician is physically on-site; "Location Unavailable" error on check-in.
- **Diagnostic Steps**:
  1. Check device location permissions in OS settings (`Settings -> FieldOps -> Location` -> set to "While Using App" and enable "Precise Location").
  2. Verify target location coordinates in web console (`Locations -> Location Details`). Ensure latitude/longitude pin is placed correctly and geofence radius (meters) is appropriate for the site topography.
  3. In mobile app, inspect GPS horizontal accuracy reading (e.g., `Accuracy: +/- 65m`).
- **Resolution**:
  - If horizontal accuracy is poor (>100m) due to indoor / basement / metal roof interference: Technician should step outside or near a window for 10 seconds to acquire satellite lock.
  - If location coordinates on map are wrong: Manager must update location pin in the Web Console.
  - If immediate check-in is required: Technician can use the Exception Override option, selecting `CLIENT_DIRECTED_OFFSITE` or `ACCESS_GATE_RESTRICTION` with a required explanatory note.

### 3.5 Attendance Issues
- **Symptoms**: "Worker already has an active open shift" error; unable to clock out; shift duration timer incorrect.
- **Diagnostic Steps**:
  1. Check web console `Attendance` board to see if an open shift is active for the worker.
  2. Verify if worker previously clocked in on another device or forgotten shift.
  3. Check device clock synchronization (device time must be synchronized via network time protocol NTP).
- **Resolution**:
  - If open shift was forgotten from previous day: Supervisor/Admin can navigate to `Attendance -> Shifts`, select the orphaned shift, and perform an "Audited Shift Adjustment", entering the agreed end time and audit reason.
  - Once the prior shift is closed, worker can immediately clock in for today.

### 3.6 Proof Upload Issues
- **Symptoms**: Photo upload fails with "Network timeout" or "File too large"; signature canvas does not save.
- **Diagnostic Steps**:
  1. Verify image file size: FieldOps client automatically downscales images to <2MB (1080p).
  2. Inspect Supabase Storage bucket status (`fieldops-media`) and storage quota.
  3. Check device storage permissions for camera/gallery.
- **Resolution**:
  - If cellular connection is weak (<100kbps): Instruct worker to save the visit locally. FieldOps offline engine will automatically upload photos once 4G/Wi-Fi connection is restored.
  - If storage quota exceeded: Owner must upgrade subscription tier in `Settings -> Billing`.

### 3.7 Billing & Subscription Issues
- **Symptoms**: "Usage limit exceeded" banner; card payment declined; invoice generation error.
- **Diagnostic Steps**:
  1. In web console, navigate to `Settings -> Billing` to inspect current subscription tier (`FREE`, `STARTER`, `GROWTH`, `BUSINESS`) and active worker / task usage counters.
  2. Check Stripe Dashboard for payment intent status (`requires_payment_method`, `succeeded`).
  3. Check `billing_events` log for webhook processing status.
- **Resolution**:
  - If card declined: Direct customer Owner to `Settings -> Billing -> Update Payment Method` to launch Stripe Customer Portal.
  - If quota exceeded: Explain plan limits. Non-destructive downgrade policy guarantees no customer data is deleted, but new task creation is paused until plan upgrade or billing cycle reset.

### 3.8 Notification Issues
- **Symptoms**: Field technician not receiving dispatch push notifications; reminders failing.
- **Diagnostic Steps**:
  1. Check device notification settings in iOS/Android OS (ensure notifications, banners, and sounds are enabled).
  2. Verify battery optimization settings: On Android (especially Samsung / Xiaomi), ensure FieldOps is set to "Unrestricted" battery usage so background notifications are not killed by OS power manager.
  3. Check FCM / APNs registration token status in `user_push_tokens` table.
- **Resolution**:
  - Instruct technician to log out and log back in, which automatically refreshes and re-registers the FCM / APNs push token with the backend.

---

## 4. Support Escalation Paths

```
[Customer Inquiry via Email / In-App]
                 │
                 ▼
     [Tier-1 Support Specialist]
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
 [Resolved via KB]    [Technical Defect / Bug]
                           │
                           ▼
              [Tier-2 Engineering Squad]
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    [Patch in Next Release]     [SEV-1 Platform Outage]
                                         │
                                         ▼
                            [On-Call Incident Commander]
                            (Activates Incident Response)
```

### Escalation Contacts:
- **Tier-1 Help Desk**: `support@fieldops.com`
- **Tier-2 Engineering**: Slack `#support-tier2-escalation`
- **On-Call Pager**: PagerDuty `fieldops-prod-oncall`
- **Security & Privacy Officer**: `security@fieldops.com`
- **Billing & Account Management**: `billing@fieldops.com`
