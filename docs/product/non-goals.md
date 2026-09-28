# FieldOps — V1 Non-Goals & Scope Boundaries

---

## 1. Purpose of This Document

To preserve engineering focus, guarantee rock-solid stability, and prevent scope creep, this document codifies what **FieldOps will NOT build in V1**.

Any proposal to implement items listed in this document during V1 must be rejected by engineering and AI agents.

---

## 2. Explicit V1 Non-Goals

### 2.1. Sales & Customer Relationship Management (CRM)
- **Excluded**: Lead capture, deal stages, sales pipeline forecasting, quote generation, sales commission tracking.
- **Rationale**: FieldOps is an operational execution engine for work already contracted, not a top-of-funnel customer acquisition tool.

### 2.2. Financial Management & Invoicing
- **Excluded**: Invoice generation, accounts receivable, payment processing, tax calculation, general ledger accounting.
- **Rationale**: Companies already use accounting tools (QuickBooks, Xero). FieldOps captures verified operational completion data that can be exported, avoiding accounting complexity.

### 2.3. Payroll & Wage Calculation
- **Excluded**: Salary calculations, tax withholdings, overtime wage formulas, tip distribution, direct deposit processing.
- **Rationale**: Payroll legislation varies wildly across jurisdictions. FieldOps tracks exact clock-in/out timestamps and duty durations; payroll calculation belongs in external payroll software.

### 2.4. Human Resources & Leave Management
- **Excluded**: Paid time off (PTO) requests, leave accruals, performance appraisals, employee benefits, onboarding workflows.
- **Rationale**: Adding HR management distracts from the core mission of dispatching and verifying physical field tasks.

### 2.5. Warehouse & Heavy Inventory Management
- **Excluded**: Warehouse bin management, automated stock replenishment, purchase orders, vendor catalogs, RFID scanning.
- **Rationale**: Full inventory systems require dedicated ERP infrastructure. V1 permits workers to record serial numbers or checklist usage, but will not manage stock levels.

### 2.6. General Messaging & Social Feeds
- **Excluded**: Company-wide social feeds, direct peer-to-peer unstructured chat, "likes" or reactions, informal group chats.
- **Rationale**: Unstructured chat generates noise and dilutes operational accountability. In FieldOps, all communication is structured as contextual notes and comments bound to a specific Task or Visit.

### 2.7. Complex Route Optimization & Automated Fleet Dispatch
- **Excluded**: Multi-vehicle traveling salesperson algorithms, dynamic traffic-based automated re-routing, fuel card tracking.
- **Rationale**: Algorithmic routing engines require complex geospatial compute clusters. In V1, supervisors assign visits manually or via calendar; workers launch native mobile navigation apps (Google Maps, Apple Maps, Waze) via deep link.

### 2.8. AI Assistant as Core Dependency
- **Excluded**: Conversational AI agents that act as mandatory dispatchers, automated AI voice calls to field workers, generative text generation for work orders.
- **Rationale**: Mission-critical field dispatch must be deterministic, transparent, and auditable. AI features may serve as assistive extensions in future phases, but never as an operational blocker.

### 2.9. Advanced Business Intelligence (BI) Engine
- **Excluded**: Custom SQL report builders, multidimensional OLAP cubes, arbitrary data science notebooks.
- **Rationale**: V1 managers require immediate operational clarity (who is late, what tasks are pending, which check-ins failed geofencing), not deep exploratory data lakes.

---

## 3. Horizon Categorization

| Domain Area | V1 Status | Future Horizon | Permanent Non-Goal |
| :--- | :--- | :--- | :--- |
| **Sales CRM / Deals** | Excluded | — | **Permanent Non-Goal** |
| **Payroll Processing** | Excluded | — | **Permanent Non-Goal** |
| **Accounting Ledger** | Excluded | — | **Permanent Non-Goal** |
| **Social Feed / Chat Room** | Excluded | — | **Permanent Non-Goal** |
| **Route Optimization Engine**| Excluded | Phase 08 / Future Horizon | Extension Point |
| **Customer Tracking Portal** | Excluded | Phase 08 / Future Horizon | Extension Point |
| **External CRM Integrations**| Excluded | Phase 08 / Future Horizon | Extension Point |
| **Automated SMS/WhatsApp Alerts** | Excluded | Phase 08 / Future Horizon | Extension Point |
| **AI Operational Assistant** | Excluded | Phase 08 / Future Horizon | Extension Point |
| **Custom Checklist Builder** | Basic in V1 | Phase 04 / Advanced Forms | Core Roadmap |
