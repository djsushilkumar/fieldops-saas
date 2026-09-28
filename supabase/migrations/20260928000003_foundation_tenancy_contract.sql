-- =============================================================================
-- Migration: 20260928000003_foundation_tenancy_contract.sql
-- Phase 02 Foundation: Tenancy contract and baseline Row-Level Security.
-- =============================================================================

-- Organizations (Tenants) Table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  subscription_tier VARCHAR(50) NOT NULL DEFAULT 'TRIAL',
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  settings JSONB NOT NULL DEFAULT '{"allowed_radius_meters": 100, "timezone": "UTC"}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for organization timestamp
DROP TRIGGER IF EXISTS trg_organizations_timestamp ON organizations;
CREATE TRIGGER trg_organizations_timestamp
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Memberships (Organization User Bindings) Table
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant_user ON memberships (organization_id, user_id);

-- -----------------------------------------------------------------------------
-- ROW-LEVEL SECURITY ENFORCEMENT
-- -----------------------------------------------------------------------------

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- Organization RLS: Users can only observe their current active organization
CREATE POLICY tenant_isolation_organizations ON organizations
  FOR ALL
  USING (id = current_tenant_id());

-- Membership RLS: Scoped strictly to current organization
CREATE POLICY tenant_isolation_memberships ON memberships
  FOR ALL
  USING (organization_id = current_tenant_id());

-- Audit Log RLS: Read-only access scoped strictly to current organization
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  FOR SELECT
  USING (organization_id = current_tenant_id());
