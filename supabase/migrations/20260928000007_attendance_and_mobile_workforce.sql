-- FieldOps Phase 06: Mobile Workforce, Attendance & Offline Operations
-- Migration: 20260928000007_attendance_and_mobile_workforce.sql

-- =============================================================================
-- 1. ATTENDANCE DOMAIN: attendance_records
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    check_out_at TIMESTAMPTZ,
    check_in_latitude DOUBLE PRECISION,
    check_in_longitude DOUBLE PRECISION,
    check_in_accuracy_meters DOUBLE PRECISION,
    check_out_latitude DOUBLE PRECISION,
    check_out_longitude DOUBLE PRECISION,
    check_out_accuracy_meters DOUBLE PRECISION,
    status TEXT NOT NULL DEFAULT 'CLOCKED_IN' CHECK (status IN ('CLOCKED_IN', 'CLOCKED_OUT', 'ON_BREAK', 'CHECKED_IN', 'CHECKED_OUT', 'CORRECTED')),
    duration_seconds INTEGER,
    notes TEXT,
    is_manually_adjusted BOOLEAN NOT NULL DEFAULT false,
    adjustment_reason TEXT,
    adjusted_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    adjusted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_tenant_user_date 
    ON public.attendance_records (organization_id, user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_records_tenant_status 
    ON public.attendance_records (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance_records_user_active 
    ON public.attendance_records (organization_id, user_id) 
    WHERE status IN ('CLOCKED_IN', 'CHECKED_IN');

-- =============================================================================
-- 2. WORKER ACTIVITY LEDGER: worker_activities
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.worker_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'ATTENDANCE_CHECKIN',
        'ATTENDANCE_CHECKOUT',
        'ATTENDANCE_CORRECTED',
        'TASK_ACCEPTED',
        'TASK_STARTED',
        'TASK_COMPLETED',
        'VISIT_EN_ROUTE',
        'VISIT_CHECKIN',
        'VISIT_CHECKOUT',
        'VISIT_COMPLETED',
        'PROOF_CAPTURED'
    )),
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_worker_activities_tenant_user_time 
    ON public.worker_activities (organization_id, user_id, created_at DESC);

-- Append-only enforcement trigger on worker_activities
CREATE OR REPLACE FUNCTION public.prevent_worker_activity_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Worker activity ledger is append-only. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_worker_activity_modification ON public.worker_activities;
CREATE TRIGGER trg_prevent_worker_activity_modification
    BEFORE UPDATE OR DELETE ON public.worker_activities
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_worker_activity_modification();

-- =============================================================================
-- 3. STORED PROCEDURES FOR ATTENDANCE
-- =============================================================================

-- Record Attendance Check-In (Prevents duplicate open shifts)
CREATE OR REPLACE FUNCTION public.record_attendance_checkin(
    p_organization_id UUID,
    p_user_id UUID,
    p_latitude DOUBLE PRECISION DEFAULT NULL,
    p_longitude DOUBLE PRECISION DEFAULT NULL,
    p_accuracy_meters DOUBLE PRECISION DEFAULT NULL,
    p_captured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_active_record RECORD;
    v_new_id UUID;
    v_result JSONB;
BEGIN
    -- Check for existing active check-in for this user in this organization
    SELECT id, check_in_at INTO v_active_record
    FROM public.attendance_records
    WHERE organization_id = p_organization_id
      AND user_id = p_user_id
      AND status IN ('CLOCKED_IN', 'CHECKED_IN')
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'User already has an active attendance session (ID: %) clocked in at %',
            v_active_record.id, v_active_record.check_in_at;
    END IF;

    -- Validate coordinate bounds if provided
    IF p_latitude IS NOT NULL AND (p_latitude < -90.0 OR p_latitude > 90.0) THEN
        RAISE EXCEPTION 'Latitude % is out of bounds [-90, 90]', p_latitude;
    END IF;
    IF p_longitude IS NOT NULL AND (p_longitude < -180.0 OR p_longitude > 180.0) THEN
        RAISE EXCEPTION 'Longitude % is out of bounds [-180, 180]', p_longitude;
    END IF;

    -- Insert new attendance record
    INSERT INTO public.attendance_records (
        organization_id,
        user_id,
        date,
        check_in_at,
        check_in_latitude,
        check_in_longitude,
        check_in_accuracy_meters,
        status,
        notes
    ) VALUES (
        p_organization_id,
        p_user_id,
        (p_captured_at AT TIME ZONE 'UTC')::DATE,
        COALESCE(p_captured_at, CURRENT_TIMESTAMP),
        p_latitude,
        p_longitude,
        p_accuracy_meters,
        'CLOCKED_IN',
        p_notes
    )
    RETURNING id INTO v_new_id;

    -- Log worker activity
    INSERT INTO public.worker_activities (
        organization_id,
        user_id,
        activity_type,
        title,
        description,
        metadata
    ) VALUES (
        p_organization_id,
        p_user_id,
        'ATTENDANCE_CHECKIN',
        'Clocked In for Workday',
        'Recorded attendance clock-in via mobile application.',
        jsonb_build_object(
            'attendance_id', v_new_id,
            'check_in_at', p_captured_at,
            'has_location', (p_latitude IS NOT NULL)
        )
    );

    SELECT to_jsonb(r) INTO v_result
    FROM public.attendance_records r
    WHERE r.id = v_new_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record Attendance Check-Out
CREATE OR REPLACE FUNCTION public.record_attendance_checkout(
    p_attendance_id UUID,
    p_latitude DOUBLE PRECISION DEFAULT NULL,
    p_longitude DOUBLE PRECISION DEFAULT NULL,
    p_accuracy_meters DOUBLE PRECISION DEFAULT NULL,
    p_captured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_record RECORD;
    v_duration_seconds INTEGER;
    v_result JSONB;
    v_checkout_time TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_record
    FROM public.attendance_records
    WHERE id = p_attendance_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attendance record % not found', p_attendance_id;
    END IF;

    IF v_record.status NOT IN ('CLOCKED_IN', 'CHECKED_IN') THEN
        RAISE EXCEPTION 'Cannot check out of attendance record in status %', v_record.status;
    END IF;

    v_checkout_time := COALESCE(p_captured_at, CURRENT_TIMESTAMP);

    IF v_checkout_time < v_record.check_in_at THEN
        RAISE EXCEPTION 'Check-out time (%) cannot be earlier than check-in time (%)',
            v_checkout_time, v_record.check_in_at;
    END IF;

    -- Calculate total duration in seconds
    v_duration_seconds := GREATEST(0, EXTRACT(EPOCH FROM (v_checkout_time - v_record.check_in_at))::INTEGER);

    UPDATE public.attendance_records
    SET check_out_at = v_checkout_time,
        check_out_latitude = p_latitude,
        check_out_longitude = p_longitude,
        check_out_accuracy_meters = p_accuracy_meters,
        status = 'CLOCKED_OUT',
        duration_seconds = v_duration_seconds,
        notes = CASE 
            WHEN p_notes IS NOT NULL AND v_record.notes IS NOT NULL THEN v_record.notes || E'\n' || p_notes
            WHEN p_notes IS NOT NULL THEN p_notes
            ELSE v_record.notes
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_attendance_id;

    -- Log worker activity
    INSERT INTO public.worker_activities (
        organization_id,
        user_id,
        activity_type,
        title,
        description,
        metadata
    ) VALUES (
        v_record.organization_id,
        v_record.user_id,
        'ATTENDANCE_CHECKOUT',
        'Clocked Out of Workday',
        format('Completed shift. Duration: %s hours %s minutes.', 
            v_duration_seconds / 3600, 
            (v_duration_seconds % 3600) / 60),
        jsonb_build_object(
            'attendance_id', p_attendance_id,
            'duration_seconds', v_duration_seconds,
            'check_out_at', v_checkout_time
        )
    );

    SELECT to_jsonb(r) INTO v_result
    FROM public.attendance_records r
    WHERE r.id = p_attendance_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manual Attendance Adjustment (Manager / Admin / Owner Audited)
CREATE OR REPLACE FUNCTION public.adjust_attendance(
    p_attendance_id UUID,
    p_admin_user_id UUID,
    p_check_in_at TIMESTAMPTZ,
    p_check_out_at TIMESTAMPTZ,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_record RECORD;
    v_duration_seconds INTEGER;
    v_result JSONB;
    v_membership RECORD;
    v_new_check_in TIMESTAMPTZ;
    v_new_check_out TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_record
    FROM public.attendance_records
    WHERE id = p_attendance_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attendance record % not found', p_attendance_id;
    END IF;

    -- Verify manager/admin/owner membership
    SELECT * INTO v_membership
    FROM public.memberships
    WHERE organization_id = v_record.organization_id
      AND user_id = p_admin_user_id
      AND role IN ('OWNER', 'ADMIN', 'MANAGER')
      AND status = 'ACTIVE';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % is not authorized to adjust attendance in organization %',
            p_admin_user_id, v_record.organization_id;
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
        RAISE EXCEPTION 'Adjustment reason must be at least 10 characters long';
    END IF;

    v_new_check_in := COALESCE(p_check_in_at, v_record.check_in_at);
    v_new_check_out := p_check_out_at;

    IF v_new_check_out IS NOT NULL AND v_new_check_out < v_new_check_in THEN
        RAISE EXCEPTION 'Check-out time cannot be earlier than check-in time';
    END IF;

    IF v_new_check_out IS NOT NULL THEN
        v_duration_seconds := GREATEST(0, EXTRACT(EPOCH FROM (v_new_check_out - v_new_check_in))::INTEGER);
    ELSE
        v_duration_seconds := NULL;
    END IF;

    UPDATE public.attendance_records
    SET check_in_at = v_new_check_in,
        check_out_at = v_new_check_out,
        duration_seconds = v_duration_seconds,
        status = 'CORRECTED',
        is_manually_adjusted = true,
        adjustment_reason = p_reason,
        adjusted_by_user_id = p_admin_user_id,
        adjusted_at = CURRENT_TIMESTAMP,
        notes = CASE 
            WHEN v_record.notes IS NOT NULL THEN v_record.notes || E'\n[Manual Adjustment] ' || p_reason
            ELSE '[Manual Adjustment] ' || p_reason
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_attendance_id;

    -- Insert into immutable audit_logs
    INSERT INTO public.audit_logs (
        organization_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        before_state,
        after_state
    ) VALUES (
        v_record.organization_id,
        p_admin_user_id,
        'ATTENDANCE_ADJUSTED',
        'attendance_records',
        p_attendance_id::text,
        jsonb_build_object(
            'check_in_at', v_record.check_in_at,
            'check_out_at', v_record.check_out_at,
            'status', v_record.status,
            'duration_seconds', v_record.duration_seconds
        ),
        jsonb_build_object(
            'check_in_at', v_new_check_in,
            'check_out_at', v_new_check_out,
            'status', 'CORRECTED',
            'duration_seconds', v_duration_seconds,
            'reason', p_reason
        )
    );

    -- Log worker activity
    INSERT INTO public.worker_activities (
        organization_id,
        user_id,
        activity_type,
        title,
        description,
        metadata
    ) VALUES (
        v_record.organization_id,
        v_record.user_id,
        'ATTENDANCE_CORRECTED',
        'Attendance Manually Adjusted',
        format('Shift adjusted by supervisor/manager: %s', p_reason),
        jsonb_build_object(
            'attendance_id', p_attendance_id,
            'adjusted_by', p_admin_user_id,
            'reason', p_reason,
            'new_check_in', v_new_check_in,
            'new_check_out', v_new_check_out
        )
    );

    SELECT to_jsonb(r) INTO v_result
    FROM public.attendance_records r
    WHERE r.id = p_attendance_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. ROW-LEVEL SECURITY POLICIES
-- =============================================================================

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_activities ENABLE ROW LEVEL SECURITY;

-- 4.1 Attendance Records RLS
CREATE POLICY "attendance_records_tenant_isolation"
    ON public.attendance_records
    FOR ALL
    USING (organization_id = public.current_tenant_id());

CREATE POLICY "attendance_records_select_access"
    ON public.attendance_records
    FOR SELECT
    USING (
        organization_id = public.current_tenant_id()
        AND (
            -- Field Workers can only see their own attendance
            user_id = auth.uid()
            -- Supervisors, Managers, Admins, Owners can view team / org
            OR EXISTS (
                SELECT 1 FROM public.memberships m
                WHERE m.organization_id = public.current_tenant_id()
                  AND m.user_id = auth.uid()
                  AND m.role IN ('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR')
                  AND m.status = 'ACTIVE'
            )
        )
    );

-- 4.2 Worker Activities RLS
CREATE POLICY "worker_activities_tenant_isolation"
    ON public.worker_activities
    FOR ALL
    USING (organization_id = public.current_tenant_id());

CREATE POLICY "worker_activities_select_access"
    ON public.worker_activities
    FOR SELECT
    USING (
        organization_id = public.current_tenant_id()
        AND (
            user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.memberships m
                WHERE m.organization_id = public.current_tenant_id()
                  AND m.user_id = auth.uid()
                  AND m.role IN ('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR')
                  AND m.status = 'ACTIVE'
            )
        )
    );
