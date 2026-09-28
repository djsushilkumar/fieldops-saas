# Centralized Entitlements & Feature Gating

## 1. Plan Entitlements Matrix

| Entitlement Key | Free | Starter | Growth | Business |
| :--- | :--- | :--- | :--- | :--- |
| `maxWorkers` | 3 | 10 | 30 | 100 |
| `maxLocations` | 5 | 25 | 100 | 500 |
| `maxMonthlyVisits` | 50 | 300 | 1,500 | 10,000 |
| `maxMonthlyExports` | 5 | 50 | 200 | 1,000 |
| `reportingEnabled` | true (View) | true (View + CSV) | true (Advanced) | true (Full + Audit) |
| `advancedReporting` | false | false | true | true |

---

## 2. Server-Side Enforcement Rules

1. **Atomic Check & Limit**:
   When inviting a new member or creating a customer location, the server verifies current entity count against the plan limit before executing the mutation:
   $$\text{Current Count} + 1 \le \text{Entitlement Limit}$$
   If the limit would be breached, the server halts execution and returns error:
   ```json
   {
     "error": {
       "code": "PLAN_LIMIT_REACHED",
       "message": "Your organization has reached the limit of 10 workers for the Starter plan. Please upgrade to Growth.",
       "request_id": "req_123"
     }
   }
   ```

2. **Downgrade Non-Destructive Invariance**:
   If an organization downgrades to a plan whose limits are below current usage, existing records are **never deleted**. Creation of new items is paused until usage drops below the new tier threshold or the organization resubscribes.
