# FieldOps — Multi-Tenant Field Force & Task Management SaaS

> **Current Phase**: **Phase 07 — Manager/Admin Web Operations Dashboard (COMPLETED)**  
> **Transition**: Moving to Phase 08 (Reporting, Analytics & SaaS Billing)  
> **Target Audience**: SMBs with distributed field teams and operational personnel.

---

## 1. What is FieldOps?

**FieldOps** is a production-grade, multi-tenant B2B SaaS platform designed to manage distributed field operations, task dispatching, field visits, and workforce accountability.

FieldOps bridges the gap between back-office managers and front-line mobile workers. It provides dispatchers, managers, and supervisors with real-time operational clarity while equipping field personnel with an offline-first mobile tool to verify their presence, complete structured tasks, and provide indisputable proof of work.

### Core Positioning Principle
> *«Assign the work. Send the right person. Verify the work. Know what happened.»*

---

## 2. Who is FieldOps For?

FieldOps is built horizontally for small and medium-sized businesses (SMBs) with teams executing physical work outside the office, including:

- **Field Service & Maintenance Companies** (HVAC, refrigeration, elevators)
- **Installation & Deployment Teams** (telecom, solar, signage, smart meters)
- **Inspection & Compliance Services** (health & safety, environmental, building code)
- **Facility Management & Commercial Cleaning** (janitorial, property turnover)
- **Security & Patrol Operations** (guard touring, incident verification)
- **Local Delivery & Specialized Logistics** (last-mile installation, courier dispatch)
- **Trade Contractors** (electrical, plumbing, mechanical, carpentry)
- **Local Operations & Field Agencies** (merchandising, mystery shopping, field research)

FieldOps is strictly focused on **operational execution**. It is **not** a general CRM, ERP, payroll engine, accounting suite, inventory warehouse system, or chat application.

---

## 3. The Fundamental Operational Workflow

Every operational workflow in FieldOps flows through a single coherent lifecycle:

```
Organization
  └── People (Employees, Contractors)
        └── Teams
              └── Tasks (Structured work packages)
                    └── Field Visits (Time & location appointments)
                          └── Attendance (Duty check-in / check-out)
                                └── Location Verification (GPS geofencing)
                                      └── Proof of Work (Checklist, Photos, Signatures, Notes)
                                            └── Completion (State transition & validation)
                                                  └── Reporting & Operational Auditing
```

---

## 4. Multi-Platform Architecture Overview

FieldOps consists of two primary application interfaces sharing a unified multi-tenant backend:

1. **Web Application (Desktop/Tablet)**:
   - Optimized for **Owners, Admins, Managers, and Supervisors**.
   - Focus: Dispatching, real-time map tracking, task allocation, visit monitoring, exception alerts, team oversight, audit logs, and operational reports.
2. **Mobile Applications (iOS & Android)**:
   - First-class native/hybrid experience for **Field Workers**.
   - Focus: Offline-first task execution, GPS check-in/out, turn-by-turn navigation launch, tamper-evident proof capture (photos, signatures, checklists), and sync transparency.

---

## 5. Development Roadmap Overview

FieldOps is built under a disciplined 10-Phase master roadmap. Progression across phases requires formal validation against predefined quality gates.

| Phase | Title | Focus & Core Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **01** | **Product, Brand & Foundation** | PRD, Personas, Roles, V1 Scope, Brand, Design Tokens, QA Strategy, Architecture Principles | **COMPLETED** |
| **02** | **Architecture & Monorepo Foundation** | Monorepo, Workspaces, Packages, Web/Mobile shell foundations, Database contract, CI pipeline | **COMPLETED** |
| **03** | **Identity, Multi-Tenancy & Access Control** | PostgreSQL RLS, Web/Mobile Authentication, RBAC, Final Owner Protection, Security Tests | **COMPLETED** |
| **04** | **Task Management Engine** | Task Domain, Lifecycle State Machine, Checklists, Attachments, Comments, Timeline, Offline Idempotency | **COMPLETED** |
| **05** | **Field Operations Engine** | Geofenced Locations, Visit Lifecycle State Machine, Haversine Distance Calculation, Check-in/out, Exception Overrides, Proof of Work, Mobile Tabbed Views, Offline Visits Queue, Security & Geospatial Suites | **COMPLETED** |
| **06** | **Attendance & Shift Tracking** | Clock-in/out, geofenced shifts, break tracking, manual time adjustments, attendance audit trail | **COMPLETED** |
| **07** | **Web Dispatch & Management Console** | Operational dashboard, live map, calendar scheduling, team workload management | **COMPLETED** |
| **08** | **Reporting, Analytics & SaaS Billing** | Operational SLA reporting, attendance export, audit trail viewer, exception dashboard, billing integration | Planned |
| **09** | **End-to-End Hardening & Security Audit** | Penetration testing, chaos testing, offline sync fuzzing, battery benchmarking | Planned |
| **10** | **Production Readiness & Launch** | Cloud infrastructure, CI/CD pipelines, observability, SLA monitoring, billing integration | Planned |

---

## 6. Repository Documentation Structure

All engineering and product documentation is organized systematically under `docs/`:

```
docs/
├── product/
│   ├── PRD.md                   # Comprehensive Product Requirements Document
│   ├── vision.md                # Vision, core promise, horizontal positioning
│   ├── scope.md                 # Detailed V1 module scope & SaaS business model
│   ├── personas.md              # Target user personas across roles
│   ├── roles.md                 # Role Capability Matrix & RBAC policies
│   ├── user-stories.md          # User stories with testable acceptance criteria
│   ├── user-flows.md            # End-to-end mobile & web user flows
│   ├── non-goals.md             # Explicit V1 boundaries & non-goals
│   └── open-decisions.md        # Consistency audit & architectural decision tracker
│
├── brand/
│   ├── brand-strategy.md        # Positioning, core values, personality traits
│   ├── naming.md                # Codename analysis & brand naming discovery
│   ├── visual-direction.md      # Visual tone, color language, design philosophy
│   └── brand-assets.md          # Asset specifications (logo, icons, splash screens)
│
├── design/
│   ├── design-principles.md     # 8 core UX principles for field and web
│   ├── design-tokens.md         # Semantic token system (colors, spacing, elevation)
│   ├── typography.md            # Type scales, readability rules, mobile considerations
│   └── component-inventory.md   # UI component inventory with props and states
│
├── architecture/
│   ├── phase-01-architecture-principles.md # Multi-tenancy, offline sync, GPS engine
│   └── adr/                     # Architecture Decision Records
│       ├── ADR-0001-record-architecture-decisions.md
│       ├── ADR-0002-offline-first-sync-engine.md
│       └── ADR-0003-tenant-isolation-model.md
│
├── security/
│   └── security-principles.md   # 10 non-negotiable security mandates & privacy rules
│
├── testing/
│   ├── testing-strategy.md      # Multi-dimensional quality model & test pyramid
│   └── phase-01-validation.md   # Phase 01 completion checklist & gate report
│
└── roadmap/
    └── roadmap.md               # 10-Phase master delivery plan
```

---

## 7. Development & Engineering Principles

1. **Phase Discipline**: Only work within the currently active phase. Never jump ahead to write premature application code.
2. **Offline-First Resilience**: Mobile clients must consider offline connectivity as the normal operating environment, not an edge case. Never lose field data.
3. **Multi-Tenant Security**: Tenant isolation is absolute. Never rely on client-side filtering; enforce isolation at the database and API query layer.
4. **Action-First UX**: Eliminate unnecessary clicks, complex forms, and visual clutter for workers wearing work gloves or operating in direct sunlight.
5. **Architectural Traceability**: Every architectural shift requires an ADR; every feature requires user stories and automated verification.

For strict agent development guidelines, see [AGENTS.md](file:///workspace/clever-darwin/AGENTS.md).
