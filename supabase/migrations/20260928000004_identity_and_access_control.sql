-- =============================================================================
-- Migration: 20260928000004_identity_and_access_control.sql
-- Phase 03: Identity, Multi-Tenancy & Access Control
-- =============================================================================

-- 1. PROFILES TABLE (User identity attributes distinct from auth credentials)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  phone VARCHAR(50),
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);

DROP TRIGGER IF EXISTS trg_profiles_timestamp ON profiles;
CREATE TRIGGER trg_profiles_timestamp
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 2. ENHANCE ORGANIZATIONS TABLE
-- Enforce strict slug format: 3-63 lowercase alphanumeric chars and hyphens, no leading/trailing hyphen
ALTER TABLE organizations 
  DROP CONSTRAINT IF EXISTS chk_org_slug_format;

ALTER TABLE organizations
  ADD CONSTRAINT chk_org_slug_format
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) >= 3 AND length(slug) <= 63);

-- 3. ENHANCE MEMBERSHIPS TABLE
-- Enforce valid roles and statuses
ALTER TABLE memberships
  DROP CONSTRAINT IF EXISTS chk_memberships_role;

ALTER TABLE memberships
  ADD CONSTRAINT chk_memberships_role
  CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'FIELD_WORKER'));

ALTER TABLE memberships
  DROP CONSTRAINT IF EXISTS chk_memberships_status;

ALTER TABLE memberships
  ADD CONSTRAINT chk_memberships_status
  CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED'));

CREATE INDEX IF NOT EXISTS idx_memberships_user_status ON memberships (user_id, status);

-- 4. ORGANIZATION INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'FIELD_WORKER')),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_tenant_email ON organization_invitations (organization_id, email);
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON organization_invitations (token_hash);

DROP TRIGGER IF EXISTS trg_invitations_timestamp ON organization_invitations;
CREATE TRIGGER trg_invitations_timestamp
  BEFORE UPDATE ON organization_invitations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 5. LAST OWNER REMOVAL PROTECTION TRIGGER
CREATE OR REPLACE FUNCTION prevent_last_owner_removal()
RETURNS TRIGGER AS $$
DECLARE
  active_owner_count INTEGER;
BEGIN
  -- Triggered on DELETE or UPDATE affecting an ACTIVE OWNER
  IF (TG_OP = 'DELETE' AND OLD.role = 'OWNER' AND OLD.status = 'ACTIVE') OR
     (TG_OP = 'UPDATE' AND OLD.role = 'OWNER' AND OLD.status = 'ACTIVE' AND (NEW.role <> 'OWNER' OR NEW.status <> 'ACTIVE')) THEN
    
    SELECT COUNT(*) INTO active_owner_count
    FROM memberships
    WHERE organization_id = OLD.organization_id
      AND role = 'OWNER'
      AND status = 'ACTIVE'
      AND id <> OLD.id;

    IF active_owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove, suspend, or demote the last remaining ACTIVE OWNER of an organization (org: %)', OLD.organization_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_last_owner_removal ON memberships;
CREATE TRIGGER trg_prevent_last_owner_removal
  BEFORE UPDATE OR DELETE ON memberships
  FOR EACH ROW EXECUTE FUNCTION prevent_last_owner_removal();

-- 6. ATOMIC TRANSACTIONAL PROCEDURES

-- Procedure: Atomic Organization creation with initial OWNER membership
CREATE OR REPLACE FUNCTION create_organization_with_owner(
  p_name VARCHAR(255),
  p_slug VARCHAR(100),
  p_user_id UUID,
  p_settings JSONB DEFAULT '{"allowed_radius_meters": 100, "timezone": "UTC"}'
)
RETURNS JSONB AS $$
DECLARE
  v_org organizations;
  v_mem memberships;
BEGIN
  -- Insert organization
  INSERT INTO organizations (name, slug, subscription_tier, subscription_status, settings)
  VALUES (p_name, p_slug, 'TRIAL', 'ACTIVE', p_settings)
  RETURNING * INTO v_org;

  -- Insert initial Owner membership
  INSERT INTO memberships (organization_id, user_id, role, status)
  VALUES (v_org.id, p_user_id, 'OWNER', 'ACTIVE')
  RETURNING * INTO v_mem;

  -- Write audit log entry
  INSERT INTO audit_logs (
    organization_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state
  ) VALUES (
    v_org.id,
    p_user_id,
    'organization.created',
    'organization',
    v_org.id::TEXT,
    NULL,
    jsonb_build_object(
      'organization_id', v_org.id,
      'name', v_org.name,
      'slug', v_org.slug,
      'owner_user_id', p_user_id
    )
  );

  RETURN jsonb_build_object(
    'organization', row_to_json(v_org),
    'membership', row_to_json(v_mem)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Procedure: Accept organization invitation with single-use token verification
CREATE OR REPLACE FUNCTION accept_organization_invitation(
  p_token_hash VARCHAR(64),
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_inv organization_invitations;
  v_mem memberships;
BEGIN
  -- 1. Fetch and lock invitation row
  SELECT * INTO v_inv
  FROM organization_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or invalid token.';
  END IF;

  IF v_inv.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Invitation is no longer pending (status: %).', v_inv.status;
  END IF;

  IF v_inv.expires_at < NOW() THEN
    UPDATE organization_invitations
    SET status = 'EXPIRED'
    WHERE id = v_inv.id;
    RAISE EXCEPTION 'Invitation token has expired.';
  END IF;

  -- 2. Mark invitation accepted
  UPDATE organization_invitations
  SET status = 'ACCEPTED',
      accepted_at = NOW()
  WHERE id = v_inv.id;

  -- 3. Upsert membership as ACTIVE
  INSERT INTO memberships (organization_id, user_id, role, status)
  VALUES (v_inv.organization_id, p_user_id, v_inv.role, 'ACTIVE')
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    status = 'ACTIVE',
    updated_at = NOW()
  RETURNING * INTO v_mem;

  -- 4. Audit log entry
  INSERT INTO audit_logs (
    organization_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state
  ) VALUES (
    v_inv.organization_id,
    p_user_id,
    'membership.accepted',
    'membership',
    v_mem.id::TEXT,
    NULL,
    jsonb_build_object(
      'membership_id', v_mem.id,
      'invitation_id', v_inv.id,
      'role', v_mem.role,
      'user_id', p_user_id
    )
  );

  RETURN jsonb_build_object(
    'membership', row_to_json(v_mem),
    'invitation', row_to_json(v_inv)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. REFINED ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on newly created tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations FORCE ROW LEVEL SECURITY;

-- Helper to check if current user is active tenant member
CREATE OR REPLACE FUNCTION is_active_tenant_member(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE organization_id = p_org_id
      AND user_id = p_user_id
      AND status = 'ACTIVE'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper to check tenant role
CREATE OR REPLACE FUNCTION has_tenant_role(p_org_id UUID, p_user_id UUID, p_roles VARCHAR[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE organization_id = p_org_id
      AND user_id = p_user_id
      AND status = 'ACTIVE'
      AND role = ANY(p_roles)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Policies for PROFILES
DROP POLICY IF EXISTS profiles_select_policy ON profiles;
CREATE POLICY profiles_select_policy ON profiles
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM memberships m1
      JOIN memberships m2 ON m1.organization_id = m2.organization_id
      WHERE m1.user_id = auth.uid()
        AND m2.user_id = profiles.user_id
        AND m1.status = 'ACTIVE'
        AND m2.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS profiles_update_policy ON profiles;
CREATE POLICY profiles_update_policy ON profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_insert_policy ON profiles;
CREATE POLICY profiles_insert_policy ON profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policies for ORGANIZATIONS
DROP POLICY IF EXISTS tenant_isolation_organizations ON organizations;
CREATE POLICY tenant_isolation_organizations ON organizations
  FOR SELECT
  USING (
    id = current_tenant_id() OR
    EXISTS (
      SELECT 1 FROM memberships
      WHERE organization_id = organizations.id
        AND user_id = auth.uid()
        AND status = 'ACTIVE'
    )
  );

CREATE POLICY tenant_update_organizations ON organizations
  FOR UPDATE
  USING (
    has_tenant_role(id, auth.uid(), ARRAY['OWNER', 'ADMIN'])
  );

-- Policies for MEMBERSHIPS
DROP POLICY IF EXISTS tenant_isolation_memberships ON memberships;
CREATE POLICY tenant_isolation_memberships ON memberships
  FOR SELECT
  USING (
    organization_id = current_tenant_id() AND
    is_active_tenant_member(organization_id, auth.uid())
  );

CREATE POLICY tenant_manage_memberships ON memberships
  FOR ALL
  USING (
    organization_id = current_tenant_id() AND
    has_tenant_role(organization_id, auth.uid(), ARRAY['OWNER', 'ADMIN'])
  );

-- Policies for ORGANIZATION INVITATIONS
CREATE POLICY tenant_invitations_policy ON organization_invitations
  FOR ALL
  USING (
    organization_id = current_tenant_id() AND
    has_tenant_role(organization_id, auth.uid(), ARRAY['OWNER', 'ADMIN'])
  );
