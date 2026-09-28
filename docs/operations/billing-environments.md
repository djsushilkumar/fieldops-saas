# Billing Environments & Configuration Strategy

## 1. Environments

| Environment | Provider Mode | API Key Type | Secret Usage | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Local / Test** | Mock / Sandbox | `sk_test_...` or Mock Provider | Local dev secrets | Unit, integration & CI testing with 0 real charges |
| **Staging** | Test / Sandbox | `sk_test_...` | Staging vault | QA, E2E verification, partner testing |
| **Production** | Live | `sk_live_...` | Production secret vault | Real customer subscriptions |

## 2. Testing Invariance
Automated test suites (`vitest`, `playwright`, `flutter test`) must **never** connect to live payment provider endpoints or trigger actual credit card charges. The default client configuration in test environments routes to `MockBillingProvider`.
