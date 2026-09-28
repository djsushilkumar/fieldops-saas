# Billing Webhook Processing & Idempotency

## 1. Webhook Lifecycle

Billing providers deliver event notifications asynchronously. Because network delivery is at-least-once, webhook handling must be strictly idempotent, replay-safe, and verifiable by cryptographic signature.

```mermaid
sequenceDiagram
    participant BP as Billing Provider (Stripe)
    participant WH as Webhook Ingestion API
    participant DB as PostgreSQL Database

    BP->>WH: POST /api/v1/billing/webhook (Headers: Signature, Timestamp)
    WH->>WH: Cryptographic HMAC Signature Verification
    alt Invalid Signature
        WH-->>BP: HTTP 400 Bad Request (Log signature failure)
    end
    WH->>DB: INSERT INTO billing_events (provider_event_id, payload, status='PENDING')
    alt Duplicate Event ID
        DB-->>WH: Unique Constraint Violation
        WH-->>BP: HTTP 200 OK (Already Processed - Idempotent Ack)
    end
    WH->>DB: Process State Transition (Update subscriptions / entitlements)
    WH->>DB: UPDATE billing_events SET status='PROCESSED'
    WH-->>BP: HTTP 200 OK
```

---

## 2. Ingested Event Types
- `checkout.session.completed`: Upgrades organization from Trialing/Free to active tier.
- `invoice.paid`: Renews subscription period (`current_period_start`, `current_period_end`), resets period counters.
- `invoice.payment_failed`: Transitions subscription to `PAST_DUE`, starts 14-day grace period.
- `customer.subscription.updated`: Reconciles plan tier or period-end cancellation flags.
- `customer.subscription.deleted`: Marks subscription `CANCELED`, sets entitlements to Free tier.
