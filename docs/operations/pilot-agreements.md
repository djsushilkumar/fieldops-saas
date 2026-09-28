# FieldOps Controlled Pilot Participation Agreements & Operational Consent

| Document Version | `1.0.0-rc.1` |
| :--- | :--- |
| **Applicability** | Controlled Pilot Program Participants |
| **Target Build** | `1.0.0` (Web) / `1.0.0+1` (Mobile) |
| **Status** | **PENDING BUSINESS / LEGAL OWNER SIGN-OFF** |

---

## 1. Governance & Execution Notice

In strict accordance with Section 15 of the FieldOps Controlled Pilot Specification:
> *"The current gate requires signed pilot agreements for: Apex Electrical Services and Metro HVAC & Mechanical. Do NOT fabricate signatures. Do NOT mark consent as complete without actual confirmation. The business/legal owner is responsible for actual agreement execution."*

This document provides the mandatory operational terms, workplace monitoring disclosures, and data privacy commitments that must be executed by authorized enterprise signatories prior to commencing field operations.

---

## 2. Mandatory Terms & Operational Disclosures

### 2.1 Point-in-Time Location Verification (No Continuous Tracking)
- **Point-in-Time Discrete Verification**: FieldOps captures GPS coordinates **strictly upon explicit, user-initiated technician interactions**:
  1. Shift Clock-In (attendance verification)
  2. Shift Clock-Out (shift closure)
  3. Visit Check-In (arrival verification at customer site)
  4. Visit Check-Out (departure verification)
- **Zero Continuous Telematics**: The platform **strictly prohibits** background hardware GPS streaming, continuous telematics breadcrumbs, speed monitoring, or transit path surveillance. When off-duty or in transit, zero coordinates are collected.

### 2.2 Purpose of Location Verification
- Coordinates are collected solely to:
  1. Verify proximity to scheduled service locations (100m geofence radius).
  2. Protect technicians from disputed service calls via objective arrival timestamps.
  3. Comply with customer contractual proof-of-presence inspection standards.

### 2.3 Operational Data Usage & Minimization
- Exported reports default to discrete boolean verification outcomes (`VERIFIED`, `OUTSIDE_RADIUS`, `EXCEPTION_OVERRIDE`) rather than exposing raw coordinate streams.
- Raw coordinates are stored in encrypted database columns with Row-Level Security (RLS) and purged according to the organization's retention policy.

### 2.4 Privacy Expectations & Off-Duty Protection
- Technicians retain complete control over device location permissions.
- In shared device mode, tapping "Logout & Wipe Device Cache" purges all local SQLite storage and cached customer information from the physical hardware.

### 2.5 Pilot Duration & Operational Support
- **Evaluation Window**: 14 continuous operational business days.
- **Support SLA**: SEV-1 critical incidents acknowledged within 30 minutes with dedicated engineering bridge (`#fieldops-pilot-support`).
- **Support Contact**: `pilot-support@fieldops.com` / Dedicated Tier-2 Engineering Specialist.

### 2.6 Data Handling, Security, & Termination
- All tenant operational data is isolated via PostgreSQL Row-Level Security.
- Upon conclusion or early termination of the pilot program, customer data may be exported via RFC 4180 CSV builder or completely purged upon written request without residual retention.

---

## 3. Pilot Participant Signature Register

### Organization A: Apex Electrical Services
- **Business Name**: Apex Electrical Services LLC
- **Primary Operational Contact**: Marcus Vance (Operations Director)
- **Authorized Legal Signatory**: Pending Execution
- **Assigned Subdomain / Slug**: `apex-electrical`
- **Field Worker Cohort**: 8 Field Electricians, 2 Supervisors, 1 Administrator
- **Agreement Status**: **PENDING BUSINESS / LEGAL OWNER EXECUTION**
- **Date Signed**: Pending

### Organization B: Metro HVAC & Mechanical
- **Business Name**: Metro HVAC & Mechanical Inc.
- **Primary Operational Contact**: Sarah Jenkins (VP Field Operations)
- **Authorized Legal Signatory**: Pending Execution
- **Assigned Subdomain / Slug**: `metro-hvac`
- **Field Worker Cohort**: 6 Service Technicians, 1 Dispatcher, 1 Administrator
- **Agreement Status**: **PENDING BUSINESS / LEGAL OWNER EXECUTION**
- **Date Signed**: Pending

---

## 4. Legal & Compliance Gate Enforcement

Until counter-signed agreements are confirmed by the FieldOps Business & Legal Sponsor:
- Mobile distribution to customer devices remains paused.
- The Controlled Pilot Gate remains formally marked **CONTROLLED PILOT BLOCKED (Reason: Pilot Consent Pending & Mobile RC Binary Compilation Pending)**.
