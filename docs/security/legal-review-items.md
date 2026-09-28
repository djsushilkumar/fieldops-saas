# FieldOps — Legal & Regulatory Compliance Review Items

> **Disclaimer**: This document identifies architectural, engineering, and data collection touchpoints requiring formal review by qualified legal counsel and privacy specialists prior to general commercial availability. It does not constitute formal legal advice or conclusions.

---

## 1. Employee Location Monitoring & Field Surveillance

### Architectural Baseline
- FieldOps intentionally implements **Point-in-Time Discrete GPS Verification** (ADR-0020 & ADR-0024) upon explicit worker actions (clock-in, clock-out, visit check-in, visit check-out).
- The platform explicitly **prohibits** continuous telematics breadcrumb tracking, background hardware GPS streaming, or vehicle fleet monitoring.
- Exported reports default to discrete verification results (`VALID`, `OUTSIDE_RADIUS`, `LOW_ACCURACY`) rather than raw coordinates.

### Legal Review Flags
1. **Notice & Consent Requirements**: Jurisdictions such as California (AB 1651 / CPRA), Illinois, and European Union member states have strict statutory notice requirements regarding electronic monitoring in the workplace. Counsel must review:
   - Mandatory in-app workplace monitoring disclosure disclosures displayed on first mobile login.
   - Whether explicit opt-in consent agreements are legally sufficient or if collective bargaining agreements (works councils) apply.
2. **Off-Duty Tracking Protections**: Confirmation that mobile OS permissions (`While Using App` vs `Always`) prevent any collection of technician coordinates when off-duty or on break.

---

## 2. Statutory Data Retention vs. Right-to-Erasure (GDPR / CCPA)

### Architectural Baseline
- Work records (time cards, attendance timestamps, proof of work photos) are retained for active subscriptions and marked for non-destructive downgrade.
- Audit logs (`audit_logs`) and financial events (`billing_events`) are immutable and protected by database triggers against updates and deletions.

### Legal Review Flags
1. **Labor Law Compliance Conflicts**: Employment standards laws typically mandate maintaining payroll-supporting hours records for 3 to 7 years. Counsel must evaluate how labor retention mandates interact with GDPR Article 17 ("Right to Erasure") requests when a former technician requests data deletion.
2. **Tenant Offboarding & Retention Windows**: Review of the 90-day grace period post-cancellation before permanent data purge to ensure alignment with standard B2B SaaS agreements.

---

## 3. SaaS Subscription, Recurring Payments & Regulatory Mandates

### Architectural Baseline
- Payment processing is handled via hosted billing provider sessions (Stripe / Razorpay). No primary account numbers (PAN), CVVs, or cardholder banking secrets touch FieldOps infrastructure (Level 1 PCI-DSS SAQ-A posture).
- Recurring subscriptions support Monthly and Annual intervals with a 14-day past-due grace period.

### Legal Review Flags
1. **Reserve Bank of India (RBI) Recurring E-Mandates**: If onboarding customers in India, recurring card transactions exceeding statutory thresholds require Additional Factor of Authentication (AFA) and pre-debit notifications 24 hours prior to charge.
2. **Auto-Renewal Statutory Disclosures**: California Automatic Renewal Law (ARL) and FTC negative option rule compliance requiring clear disclosure of cancellation mechanisms before billing.

---

## 4. Cross-Border Data Transfers & Data Residency

### Architectural Baseline
- FieldOps production instances run in designated cloud regions with encrypted data in transit (TLS 1.3) and at rest (AES-256).

### Legal Review Flags
1. **Standard Contractual Clauses (SCCs)**: Review of international data transfer agreements if EU/UK technician attendance or customer site data is processed in US cloud regions.
2. **India Digital Personal Data Protection Act (DPDP Act 2023)**: Counsel review of data fiduciary obligations, breach notification timelines (6 hours to CERT-In), and cross-border transfer allowances.
