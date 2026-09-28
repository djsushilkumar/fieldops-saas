-- =============================================================================
-- Migration: 20260928000002_foundation_audit_and_rls_helpers.sql
-- Phase 02 Foundation: Tenant extraction helpers, update triggers & audit log.
-- =============================================================================

-- Helper function to extract current active tenant_id from connection context or JWT
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
  -- 1. Check local session variable (used by API connection pool / workers)
  IF current_setting('app.current_tenant_id', true) IS NOT NULL AND current_setting('app.current_tenant_id', true) <> '' THEN
    RETURN current_setting('app.current_tenant_id', true)::UUID;
  END IF;

  -- 2. Fallback to Supabase auth JWT claims
  IF auth.jwt() IS NOT NULL AND auth.jwt() -> 'app_metadata' ->> 'tenant_id' IS NOT NULL THEN
    RETURN (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Trigger function to automatically maintain updated_at timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Immutable audit logs table for security-sensitive operational actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  before_state JSONB,
  after_state JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_time ON audit_logs (organization_id, created_at DESC);

-- Prohibit direct UPDATE or DELETE on audit logs to guarantee immutability
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_update ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_update
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
