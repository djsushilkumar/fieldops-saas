# SaaS Billing Security & PCI Scope Minimization

## 1. Zero-Card-Data Invariance
FieldOps servers **never** receive, transmit, process, or store credit card numbers, CVVs, expiration dates, or bank account credentials. All payment collection uses the billing provider's hosted checkout sessions and PCI-DSS Level 1 compliant customer portal.

## 2. Secrets Management
- Provider secret API keys (`STRIPE_SECRET_KEY`) and webhook signing secrets (`STRIPE_WEBHOOK_SECRET`) reside exclusively in server-side environment variables.
- Client bundles (`apps/web`, `apps/mobile`) only receive public anonymous keys or session redirect URLs.
- The service-role database key is restricted to trusted background worker execution.

## 3. Role-Based Access for Billing
- Only the organization `OWNER` has authority to change subscription plans, initiate checkout, or cancel subscriptions (`Permissions.ORG_BILLING_MANAGE`).
- Organization `ADMIN` can view billing status, usage meters, and invoice history (`Permissions.ORG_BILLING_VIEW`).
- `MANAGER`, `SUPERVISOR`, and `FIELD_WORKER` roles have zero access to billing interfaces.
