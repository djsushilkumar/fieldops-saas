# ADR-0023: SaaS Billing Provider Abstraction & Subscription Lifecycle

## Context

FieldOps is a multi-tenant B2B SaaS platform monetized via tiered recurring subscriptions (Free, Starter, Growth, Business). The system requires:
1. Flexible recurring subscription billing with support for international payment cards and Indian regulatory compliance (RBI recurring e-mandates / 3D Secure).
2. Clean separation between the operational domain (tasks, visits, attendance) and commercial billing domain.
3. Centralized entitlement evaluation and server-side limit enforcement (e.g. maximum workers, maximum customer locations, monthly visits).
4. Reliable webhook ingestion with signature verification, replay protection, and strict idempotency.
5. In-app customer billing portal for payment method updates and invoice access.

Hard-coding the application directly to a single billing SDK creates vendor lock-in and impedes automated testing. Automated CI test suites must never execute live monetary charges.

## Decision

1. **Provider Abstraction Layer**:
   We establish a clean `BillingProvider` interface decoupling FieldOps from specific vendor SDKs:
   - `createCustomer(params)`
   - `createCheckoutSession(params)`
   - `createPortalSession(params)`
   - `getSubscription(providerSubscriptionId)`
   - `cancelSubscription(providerSubscriptionId, atPeriodEnd)`
   - `verifyWebhookSignature(payload, signature, secret)`
   A production-ready `StripeBillingProvider` handles live card transactions and portal redirects, while a deterministic `MockBillingProvider` operates in testing/sandbox mode without network calls or external secrets.

2. **Internal Source of Truth**:
   The FieldOps PostgreSQL database (`billing_accounts`, `subscriptions`, `usage_counters`) is the application's internal source of truth for entitlements and operational limits. External billing providers are authoritative only for provider-side payment execution and renewal events. Provider events are synchronized into FieldOps via verified webhooks.

3. **Subscription Lifecycle & Downgrades**:
   - Valid subscription states: `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `EXPIRED`, `INCOMPLETE`, `PAUSED`.
   - **Period-End Cancellation**: Canceling a subscription sets `cancel_at_period_end = true`. The organization retains active entitlements until `current_period_end`.
   - **Downgrades & Limit Exceeded**: When an organization downgrades to a plan with lower limits (e.g. from 20 workers to 10 workers while having 15 active workers), FieldOps **never** deletes existing operational records. Instead, new entity creation is blocked with a stable `PLAN_LIMIT_REACHED` error code until the organization upgrades or offboards excess resources.

4. **Idempotent Webhooks**:
   Every incoming webhook is verified by signature, logged into `billing_events` with a unique constraint on `provider_event_id`, and evaluated within a database transaction. Duplicate delivery of the same event ID returns HTTP 200 without mutating subscription state twice.

## Consequences

- Zero credit card numbers or banking secrets touch FieldOps servers (Level 1 PCI-DSS compliance via hosted checkout/portal).
- Automated tests run entirely in-memory with deterministic sandbox behavior.
- Operational code checks entitlements via pure helper functions (`canCreateWorker(orgId)`) rather than querying third-party APIs.
