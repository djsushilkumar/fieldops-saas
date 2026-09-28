# FieldOps — Comprehensive Security Threat Model

## 1. Overview & Scope

This document establishes the comprehensive threat model for the FieldOps multi-tenant Field Force and Task Management SaaS platform. It models threat actors, trust boundaries, entry points, and mitigations across Web, Mobile (iOS/Android), API, Database (PostgreSQL/Supabase), Storage, and Third-Party Billing integrations.

---

## 2. Threat Actors

| Actor | Profile & Motivation | Capabilities & Access | Risk Level |
| :--- | :--- | :--- | :--- |
| **Anonymous User** | External unauthenticated internet client; automated scanners, credential stuffers. | Public endpoints (`/auth/login`, `/auth/signup`, `/health`). | Moderate |
| **Field Worker** | Legitimate worker using mobile application on cellular network. Motivated to log false attendance, bypass geofence, or access other crews' data. | Authenticated mobile session, local SQLite DB, offline mutation queue, GPS sensor. | High |
| **Supervisor / Manager** | Operational management user scheduling visits and assigning tasks. | Web console access, team-scoped queries, task dispatching. | Moderate |
| **Admin** | Organization administrator managing workforce, memberships, and operational locations. | Member invitation, location management, operational configuration. | High |
| **Owner** | Primary organization tenant owner controlling commercial billing, plan upgrades, and ownership. | Full tenant access, Stripe portal checkout, organization deletion. | High |
| **Malicious Org Member** | Insider attempting horizontal privilege escalation (accessing other tenants) or vertical privilege escalation (worker elevating to admin). | Valid JWT within one tenant, API client, browser dev tools, network proxy. | Critical |
| **Compromised Account** | Legitimate user credentials compromised via credential stuffing, phishing, or stolen session token. | Authorized actions of the compromised role. | Critical |
| **Malicious External Actor** | Advanced persistent threat or opportunistic attacker targeting cloud infrastructure, APIs, or database. | Network-level attacks, fuzzing, brute force, DDoS, dependency poisoning. | Critical |
| **Compromised Device** | Stolen or jailbroken/rooted mobile device running FieldOps mobile app. | Direct access to local SQLite/Drift database, memory inspection, mocked GPS provider. | High |
| **Malicious Webhook Sender** | Adversary attempting to spoof billing events (e.g. fake invoice payment) to acquire free premium access. | Ability to POST to public webhook ingestion endpoints. | Critical |
| **Malicious File Uploader** | User attempting to upload webshells, executable binaries, path traversal sequences, or infected SVG/PDF files. | Storage upload endpoints. | High |

---

## 3. Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Trust Boundary 1: Client to Edge / Gateway                                 │
│ Browser (Web) / Flutter App (Mobile) ──[ HTTPS / TLS 1.3 ]──> Web API / Edge│
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ Trust Boundary 2: Application Server to Persistence Layer                    │
│ Web API / Edge Functions ──[ Authenticated Session ]──> Supabase / PostgREST │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ Trust Boundary 3: Multi-Tenant Database Isolation Engine                    │
│ PostgreSQL Engine ──[ PostgreSQL RLS: current_tenant_id() ]──> Tables & Data │
└─────────────────────────────────────────────────────────────────────────────┘
                                       ▲
┌──────────────────────────────────────┴──────────────────────────────────────┐
│ Trust Boundary 4: External Third-Party Webhook Ingestion                     │
│ Stripe / Provider ──[ Signed Webhook + HMAC SHA-256 ]──> Webhook Controller │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ Trust Boundary 5: Object Storage & Pre-Signed Media                          │
│ Client Direct Upload ──[ 15-min TTL Pre-Signed URL ]──> S3 Storage Bucket   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Threat Categories & Defenses (STRIDE Matrix)

### 4.1. Spoofing
- **Threat**: Spoofing another tenant's identity via `x-tenant-id` header injection.
- **Defense**: Server-side tenant verification checks PostgreSQL `memberships` table for active membership matching `auth.uid()`. Client headers are validated against cryptographic JWT claims.
- **Threat**: Spoofing billing provider webhooks.
- **Defense**: Deterministic HMAC SHA-256 signature verification over raw request payload using private webhook secret. Replay attacks prevented by unique `provider_event_id` constraint.

### 4.2. Tampering
- **Threat**: Client-side tampering with GPS coordinates to fake check-in within geofence radius.
- **Defense**: Mathematical Haversine verification server-side; evaluation of accuracy thresholds ($\le 150\text{m}$) and staleness ($\le 120\text{s}$); discrete `LocationVerificationResult` classification.
- **Threat**: Altering historical audit trail or attendance shifts.
- **Defense**: Database triggers `prevent_audit_log_modification` strictly reject `UPDATE` or `DELETE` on `audit_logs`. Manual attendance adjustments create new audited event records without erasing original punches.

### 4.3. Repudiation
- **Threat**: Worker claims they never checked into a location or completed a task.
- **Defense**: Immutable `worker_activities` ledger records actor ID, point-in-time timestamp, GPS fix accuracy, and verified proof attachments.

### 4.4. Information Disclosure
- **Threat**: Cross-tenant IDOR reading tasks, customer locations, attendance logs, or billing invoices.
- **Defense**: Multi-tenant Row-Level Security (RLS) on all 27 database tables partitioned by `current_tenant_id()`. Direct UUID references belonging to foreign tenants return `403 FORBIDDEN` / `404 NOT FOUND`.
- **Threat**: Leaking raw GPS coordinate breadcrumbs of workers in CSV exports or push notifications.
- **Defense**: Location privacy mandate (ADR-0020 & ADR-0024); exports output discrete verification status (`VALID`, `OUTSIDE_RADIUS`) and exclude continuous breadcrumbs.

### 4.5. Denial of Service
- **Threat**: Excessive export row requests or large file uploads exhausting memory.
- **Defense**: Bounded export limits ($5,000$ rows maximum); $15\text{MB}$ strict storage bucket limit; atomic quota counters (`usage_counters`) preventing runaway dispatch.

### 4.6. Elevation of Privilege
- **Threat**: Field Worker issuing API request to invite members or upgrade subscription.
- **Defense**: Server-side RBAC validation (`can(role, Permissions)`); billing console and mutations restricted strictly to `OWNER`.
