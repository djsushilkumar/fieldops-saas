# FieldOps Privacy Policy

**Effective Date: September 28, 2026**  
**Last Updated: September 28, 2026**

This Privacy Policy describes how FieldOps ("we", "us", or "our") collects, uses, protects, and discloses personal data when you use the FieldOps SaaS platform, web operations console, and mobile applications (collectively, the "Service").

---

## 1. Information We Collect

### 1.1 Account & Identity Information
- **User Profile**: Full name, business email address, phone number, encrypted password hash, and assigned organizational role (Owner, Admin, Manager, Dispatcher, Field Worker).
- **Organization Data**: Business name, workspace URL slug, assigned teams, and operational settings.

### 1.2 Operational Field Data
- **Tasks & Visits**: Work order descriptions, scheduled arrival times, checklists, field notes, and completion statuses.
- **Proof of Work**: Photographs captured on-site, customer digital signatures, and inspection attachments uploaded to verify job completion.
- **Attendance Records**: Shift start timestamps, shift end timestamps, break intervals, and audited manual time corrections.

### 1.3 Geospatial & Location Information
- **Discrete Point-in-Time GPS Capture**: When a field worker performs an operational action (such as clocking into a shift or checking into a customer visit), the device acquires a single point-in-time latitude, longitude, and accuracy radius.
- **No Continuous Tracking**: FieldOps **does NOT track or log continuous GPS breadcrumbs, travel paths, or background location history**. Once an arrival or departure event is verified against the destination geofence radius, GPS location acquisition immediately terminates.

### 1.4 Technical & Device Telemetry
- **Device Identifiers**: Operating system version, device model, app build version, and push notification tokens (FCM/APNS).
- **Diagnostics**: Anonymized crash logs and performance metrics (captured via Sentry) to resolve software bugs.

---

## 2. How We Use Information

We process personal and operational data strictly to:
1. Provide, authenticate, and maintain the FieldOps multi-tenant Service.
2. Verify field presence within customer geofences and prevent fraudulent dispatch reports.
3. Synchronize offline field mutations reliably to the cloud database.
4. Generate operational reports, attendance records, and verifiable proof of work for business customers.
5. Process subscription billing and calculate usage entitlements.
6. Provide customer support and troubleshoot operational incidents.

---

## 3. Data Sub-Processors

We share data only with infrastructure sub-processors necessary to deliver the Service under strict Data Processing Agreements (DPAs):

| Sub-Processor | Purpose | Location | Security Certification |
| :--- | :--- | :--- | :--- |
| **Supabase / PostgreSQL** | Database storage, authentication & Row-Level Security | US / EU Region | SOC 2 Type II, ISO 27001 |
| **Amazon Web Services (AWS)** | Cloud compute, private object storage & continuous backup | US / EU Region | SOC 1/2/3, ISO 27001 |
| **Stripe, Inc.** | SaaS subscription processing & customer billing portal | Global / US | PCI-DSS Level 1 |
| **Functional Software (Sentry)** | Application crash logging and performance monitoring | US Region | SOC 2 Type II |
| **Twilio (SendGrid)** | Transactional email delivery (invitations, password resets)| US Region | SOC 2 Type II |

---

## 4. Multi-Tenant Data Isolation & Security

- **Row-Level Security (RLS)**: 100% of customer data is partitioned by Organization ID (`tenant_id`). Cross-tenant access is structurally prevented at the database kernel level.
- **Encryption at Rest**: All database tables, WAL archives, and object storage buckets are encrypted using AES-256.
- **Encryption in Transit**: All network communications require TLS 1.3 / 1.2 with strict HTTP Strict Transport Security (HSTS).

---

## 5. Data Retention & Deletion Rights

- **Active Subscriptions**: Data is retained for the duration of the customer's active subscription.
- **Labor Law Retention Invariant**: Under applicable statutory labor frameworks, time and attendance records are archived for up to 3 years to support wage and hour verification.
- **Right to Erasure (GDPR / DPDP)**: Upon verified customer request, personal identifiers are pseudonymized or permanently expunged, subject to statutory audit and labor law retention obligations as documented in [Legal Review Items](file:///workspace/clever-darwin/docs/security/legal-review-items.md).
- **Account Termination**: Upon formal cancellation, customer data is purged from active databases within 30 days and completely overwritten in rolling backups within 60 days.

---

## 6. Contact & Privacy Inquiries

For privacy questions, data subject access requests (DSAR), or Data Protection Officer inquiries:
- **Email**: `privacy@fieldops.com`
- **Address**: FieldOps Security & Privacy Team, 100 Enterprise Way, Suite 400, San Francisco, CA 94105.
