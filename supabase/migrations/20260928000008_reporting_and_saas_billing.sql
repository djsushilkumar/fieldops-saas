-- FieldOps Phase 08: Reports, Exports, Usage Metering & SaaS Billing
-- Migration: 20260928000008_reporting_and_saas_billing.sql

-- =============================================================================
-- 1. SAAS BILLING ACCOUNTS & SUBSCRIPTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.billing_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'MOCK' CHECK (provider IN ('MOCK', 'STRIPE', 'RAZORPAY')),
    provider_customer_id TEXT NOT NULL,
    billing_email TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_billing_accounts_organization UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    billing_account_id UUID REFERENCES public.billing_accounts(id) ON DELETE SET NULL,
    plan TEXT NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'STARTER', 'GROWTH', 'BUSINESS')),
    status TEXT NOT NULL DEFAULT 'TRIALING' CHECK (status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'INCOMPLETE', 'PAUSED')),
    provider_subscription_id TEXT,
    billing_interval TEXT NOT NULL DEFAULT 'MONTH' CHECK (billing_interval IN ('MONTH', 'YEAR')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days'),
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    canceled_at TIMESTAMPTZ,
    trial_end TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days'),
    grace_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_subscriptions_organization UNIQUE (organization_id)
);

-- =============================================================================
-- 2. USAGE COUNTERS & METERING
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.usage_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    metric VARCHAR(64) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    current_usage INTEGER NOT NULL DEFAULT 0 CHECK (current_usage >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_usage_counters_org_metric_period UNIQUE (organization_id, metric, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_org_metric 
    ON public.usage_counters (organization_id, metric, period_start, period_end);

-- =============================================================================
-- 3. BILLING EVENTS & WEBHOOK IDEMPOTENCY
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('MOCK', 'STRIPE', 'RAZORPAY')),
    provider_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_billing_events_provider_event UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_events_org 
    ON public.billing_events (organization_id, created_at DESC);

-- =============================================================================
-- 4. REPORT AUDIT LOGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.report_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN ('TASKS', 'VISITS', 'ATTENDANCE', 'WORKFORCE')),
    format TEXT NOT NULL CHECK (format IN ('CSV', 'JSON')),
    filter_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    row_count INTEGER NOT NULL DEFAULT 0,
    exported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_audit_logs_org_exported 
    ON public.report_audit_logs (organization_id, exported_at DESC);

-- =============================================================================
-- 5. REPORTING PERFORMANCE OPTIMIZATION INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_reporting 
    ON public.tasks (organization_id, due_at, status);

CREATE INDEX IF NOT EXISTS idx_visits_reporting 
    ON public.visits (organization_id, scheduled_start, status);

CREATE INDEX IF NOT EXISTS idx_attendance_reporting 
    ON public.attendance_records (organization_id, date, status);

-- =============================================================================
-- 6. ATOMIC USAGE INCREMENT STORED PROCEDURE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_and_increment_usage(
    p_organization_id UUID,
    p_metric VARCHAR,
    p_period_start TIMESTAMPTZ,
    p_period_end TIMESTAMPTZ,
    p_increment INTEGER DEFAULT 1,
    p_max_limit INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_usage INTEGER;
    v_new_usage INTEGER;
BEGIN
    -- Upsert usage counter row with locking
    INSERT INTO public.usage_counters (
        organization_id,
        metric,
        period_start,
        period_end,
        current_usage,
        updated_at
    ) VALUES (
        p_organization_id,
        p_metric,
        p_period_start,
        p_period_end,
        0,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (organization_id, metric, period_start)
    DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    RETURNING current_usage INTO v_current_usage;

    -- Check if limit exceeded
    IF p_max_limit IS NOT NULL AND (v_current_usage + p_increment) > p_max_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current_usage', v_current_usage,
            'limit', p_max_limit,
            'metric', p_metric
        );
    END IF;

    -- Increment usage
    UPDATE public.usage_counters
    SET current_usage = current_usage + p_increment,
        updated_at = CURRENT_TIMESTAMP
    WHERE organization_id = p_organization_id
      AND metric = p_metric
      AND period_start = p_period_start
    RETURNING current_usage INTO v_new_usage;

    RETURN jsonb_build_object(
        'allowed', true,
        'current_usage', v_new_usage,
        'limit', p_max_limit,
        'metric', p_metric
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 7. ROW-LEVEL SECURITY POLICIES
-- =============================================================================

ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_audit_logs ENABLE ROW LEVEL SECURITY;

-- 7.1 Billing Accounts RLS
CREATE POLICY "billing_accounts_tenant_isolation"
    ON public.billing_accounts
    FOR ALL
    USING (organization_id = public.current_tenant_id());

CREATE POLICY "billing_accounts_admin_owner_select"
    ON public.billing_accounts
    FOR SELECT
    USING (
        organization_id = public.current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = public.current_tenant_id()
              AND m.user_id = auth.uid()
              AND m.role IN ('OWNER', 'ADMIN')
              AND m.status = 'ACTIVE'
        )
    );

CREATE POLICY "billing_accounts_owner_modify"
    ON public.billing_accounts
    FOR ALL
    USING (
        organization_id = public.current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = public.current_tenant_id()
              AND m.user_id = auth.uid()
              AND m.role = 'OWNER'
              AND m.status = 'ACTIVE'
        )
    );

-- 7.2 Subscriptions RLS
CREATE POLICY "subscriptions_tenant_isolation"
    ON public.subscriptions
    FOR ALL
    USING (organization_id = public.current_tenant_id());

CREATE POLICY "subscriptions_admin_owner_select"
    ON public.subscriptions
    FOR SELECT
    USING (
        organization_id = public.current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = public.current_tenant_id()
              AND m.user_id = auth.uid()
              AND m.role IN ('OWNER', 'ADMIN')
              AND m.status = 'ACTIVE'
        )
    );

CREATE POLICY "subscriptions_owner_modify"
    ON public.subscriptions
    FOR ALL
    USING (
        organization_id = public.current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = public.current_tenant_id()
              AND m.user_id = auth.uid()
              AND m.role = 'OWNER'
              AND m.status = 'ACTIVE'
        )
    );

-- 7.3 Usage Counters RLS
CREATE POLICY "usage_counters_tenant_isolation"
    ON public.usage_counters
    FOR ALL
    USING (organization_id = public.current_tenant_id());

CREATE POLICY "usage_counters_select"
    ON public.usage_counters
    FOR SELECT
    USING (
        organization_id = public.current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = public.current_tenant_id()
              AND m.user_id = auth.uid()
              AND m.role IN ('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR')
              AND m.status = 'ACTIVE'
        )
    );

-- 7.4 Billing Events RLS
CREATE POLICY "billing_events_tenant_isolation"
    ON public.billing_events
    FOR ALL
    USING (organization_id = public.current_tenant_id());

CREATE POLICY "billing_events_admin_owner_select"
    ON public.billing_events
    FOR SELECT
    USING (
        organization_id = public.current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = public.current_tenant_id()
              AND m.user_id = auth.uid()
              AND m.role IN ('OWNER', 'ADMIN')
              AND m.status = 'ACTIVE'
        )
    );

-- 7.5 Report Audit Logs RLS
CREATE POLICY "report_audit_logs_tenant_isolation"
    ON public.report_audit_logs
    FOR ALL
    USING (organization_id = public.current_tenant_id());

CREATE POLICY "report_audit_logs_admin_owner_select"
    ON public.report_audit_logs
    FOR SELECT
    USING (
        organization_id = public.current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = public.current_tenant_id()
              AND m.user_id = auth.uid()
              AND m.role IN ('OWNER', 'ADMIN')
              AND m.status = 'ACTIVE'
        )
    );

CREATE POLICY "report_audit_logs_insert"
    ON public.report_audit_logs
    FOR INSERT
    WITH CHECK (
        organization_id = public.current_tenant_id()
        AND user_id = auth.uid()
    );
