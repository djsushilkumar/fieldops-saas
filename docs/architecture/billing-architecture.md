# SaaS Billing Architecture

## 1. Domain Separation & Conceptual Model

```mermaid
graph TD
    subgraph Operational Domain
        O[Organization]
        W[Workforce]
        T[Tasks]
        V[Visits]
        L[Locations]
    end

    subgraph Commercial Billing Domain
        O --> BA[Billing Account]
        BA --> S[Subscription]
        S --> P[Plan Configuration]
        P --> E[Entitlements Matrix]
        O --> UC[Usage Counters]
    end

    subgraph External Provider
        SP[Stripe / Sandbox Provider]
        S <-->|Webhooks / Sync| SP
    end
```

## 2. Source of Truth Principle
1. **Application Database**: The FieldOps database is the authoritative source of truth for organization entitlements, plan tiers, and usage limits.
2. **Provider Responsibilities**: The external billing provider is authoritative for processing payments, managing stored payment methods, calculating regional taxes, and emitting lifecycle events.
3. **No Per-Request External Calls**: Core application requests evaluate entitlements against cached/internal PostgreSQL subscription records without issuing external HTTP calls to the billing provider.
