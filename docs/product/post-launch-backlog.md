# Post-Launch Product Backlog & Scope Governance — FieldOps SaaS

| Document Version | 1.0.0 |
| :--- | :--- |
| **Phase** | **Phase 10 — Production Launch & Operations** |
| **Governance Authority** | **Product Requirements Document (`docs/product/PRD.md`) & AGENTS.md** |
| **Principle** | **Protect core V1 focus; strictly isolate out-of-scope requests** |

---

## 1. Classification Framework

To prevent scope creep and maintain operational focus during stabilization, all post-launch customer feedback is categorized into one of five disciplined buckets:

1. **`BUG`**: Unintended defect or regression violating existing functional acceptance criteria.
2. **`USABILITY_ISSUE`**: Confusion or friction in existing workflows that impairs first-run success without altering architecture.
3. **`MISSING_V1`**: Planned feature explicitly documented in `docs/product/scope.md` that was deferred.
4. **`FUTURE_FEATURE`**: Valid functional enhancement appropriate for future product versions (V2+).
5. **`OUT_OF_SCOPE`**: Functionality fundamentally misaligned with FieldOps core horizontal positioning (e.g., continuous fleet telematics, full CRM, direct messaging).

---

## 2. Categorized Backlog Items

| Item ID | Classification | Title & Description | Target Milestones | Architecture / Scope Notes |
| :--- | :--- | :--- | :---: | :--- |
| **PLB-01** | `USABILITY_ISSUE` | Quick-filter presets on Attendance Board (Today, Yesterday, Last 7 Days) | Sprint 1.1 | Enhances web operations dashboard without changing API schema. |
| **PLB-02** | `USABILITY_ISSUE` | Mobile haptic feedback on successful geofence check-in | Sprint 1.1 | Confirms arrival tactilely on noisy job sites. |
| **PLB-03** | `FUTURE_FEATURE` | Barcode & QR Code scanner for task asset verification | V1.2 | Leverages mobile camera; requires schema extension for asset tags. |
| **PLB-04** | `FUTURE_FEATURE` | Customer self-service portal for tracking technician arrival window | V2.0 | Public unauthenticated token link with read-only appointment status. |
| **PLB-05** | `FUTURE_FEATURE` | Multi-language localization (Spanish, French, Portuguese) | V1.3 | Flutter `intl` and Next.js i18n dictionary expansions. |
| **PLB-06** | `OUT_OF_SCOPE` | Continuous real-time GPS tracking / breadcrumb driver monitoring | **REJECTED** | Violates privacy principle and battery budget. FieldOps is discrete point-in-time presence verification only. |
| **PLB-07** | `OUT_OF_SCOPE` | General internal instant messaging / chat feed between employees | **REJECTED** | FieldOps is an operational task platform, not a communication tool (Slack/WhatsApp are external). |
| **PLB-08** | `OUT_OF_SCOPE` | Full CRM pipeline, lead scoring, and sales quotation engine | **REJECTED** | Violates product charter. FieldOps focuses strictly on operational execution after work order creation. |
| **PLB-09** | `OUT_OF_SCOPE` | Autonomous AI dispatching without supervisor confirmation | **REJECTED** | Operational dispatch requires deterministic supervisor accountability. |

---

## 3. Product Feedback Intake SLA

- Incoming support requests tagged as feature suggestions are reviewed weekly by Product Management.
- Items classified as `OUT_OF_SCOPE` receive a polite, standardized response explaining our product design philosophy:
  > *"FieldOps is intentionally focused on discrete task execution, verified attendance, and proof of work. Continuous tracking and sales CRM workflows are handled via specialized third-party tools via our export integrations."*
