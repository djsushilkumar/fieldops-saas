# Usage Metering & Quotas

## 1. Metered Metrics

FieldOps meters two classes of operational metrics:

1. **High-Watermark Inventory (Point-in-Time)**:
   - `workers`: Active organization memberships where `role = FIELD_WORKER` or operational staff.
   - `locations`: Active customer locations where `status = ACTIVE`.

2. **Cumulative Period Volume (Monthly Rolling Window)**:
   - `monthly_visits`: Total visits scheduled or executed within the active subscription cycle ($T_{\text{period\_start}} \le \text{created\_at} < T_{\text{period\_end}}$).
   - `monthly_exports`: Total CSV/JSON reports exported within the billing cycle.

---

## 2. Metering Table & Atomic Counter

Usage is tracked in `usage_counters`:
```sql
CREATE TABLE usage_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    metric VARCHAR(64) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    current_usage INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, metric, period_start)
);
```

The database function `check_and_increment_usage` atomically increments the counter and verifies whether the proposed action would exceed the current limit, preventing race conditions under concurrent dispatch.
