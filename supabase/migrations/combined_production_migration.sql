-- =============================================================================
-- Migration: 20260928000001_foundation_extensions.sql
-- Phase 02 Foundation: Essential PostgreSQL extensions for FieldOps.
-- =============================================================================

-- Enable cryptographic functions (UUID generation, hashing)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for high-accuracy geodesic distance and spatial indexing
CREATE EXTENSION IF NOT EXISTS "postgis";
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
-- =============================================================================
-- Migration: 20260928000005_task_management_engine.sql
-- Phase 04: Task Management Engine, Checklists, Activity Timeline & Offline Sync
-- =============================================================================

-- 1. TEAMS TABLE & TEAM MEMBERS
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams (organization_id);

DROP TRIGGER IF EXISTS trg_teams_timestamp ON teams;
CREATE TRIGGER trg_teams_timestamp
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_tenant ON team_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id);

-- 2. TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
  created_by UUID NOT NULL,
  assigned_to UUID,
  assigned_team UUID REFERENCES teams(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  blocked_reason TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_tasks_status CHECK (
    status IN ('DRAFT', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELED')
  ),
  CONSTRAINT chk_tasks_priority CHECK (
    priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
  )
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status ON tasks (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_assignee ON tasks (organization_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_team ON tasks (organization_id, assigned_team);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_due ON tasks (organization_id, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_priority ON tasks (organization_id, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_created ON tasks (organization_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_tasks_timestamp ON tasks;
CREATE TRIGGER trg_tasks_timestamp
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 3. TASK CHECKLISTS TABLE
CREATE TABLE IF NOT EXISTS task_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklists_task_order ON task_checklists (task_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_checklists_tenant ON task_checklists (organization_id);

DROP TRIGGER IF EXISTS trg_checklists_timestamp ON task_checklists;
CREATE TRIGGER trg_checklists_timestamp
  BEFORE UPDATE ON task_checklists
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 4. TASK ATTACHMENTS TABLE
CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_task ON task_attachments (task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attachments_tenant ON task_attachments (organization_id);

-- 5. TASK COMMENTS / NOTES TABLE
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments (task_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_tenant ON task_comments (organization_id);

DROP TRIGGER IF EXISTS trg_comments_timestamp ON task_comments;
CREATE TRIGGER trg_comments_timestamp
  BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 6. TASK ACTIVITIES TABLE (Append-Only Operational Timeline)
CREATE TABLE IF NOT EXISTS task_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_task ON task_activities (task_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_activities_tenant ON task_activities (organization_id);

-- Prevent UPDATE or DELETE on task_activities to enforce timeline immutability
CREATE OR REPLACE FUNCTION prevent_task_activity_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Task activity records are immutable append-only events.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_activity_mod ON task_activities;
CREATE TRIGGER trg_prevent_activity_mod
  BEFORE UPDATE OR DELETE ON task_activities
  FOR EACH ROW EXECUTE FUNCTION prevent_task_activity_modification();

-- 7. OFFLINE MUTATIONS DEDUPLICATION TABLE
CREATE TABLE IF NOT EXISTS offline_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mutation_id UUID NOT NULL UNIQUE,
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'SYNCED',
  client_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offline_idempotency ON offline_mutations (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_offline_tenant_user ON offline_mutations (organization_id, user_id);

-- 8. TASK STATE MACHINE TRANSITION FUNCTION
CREATE OR REPLACE FUNCTION transition_task_status(
  p_task_id UUID,
  p_target_status VARCHAR(50),
  p_actor_id UUID,
  p_blocked_reason TEXT DEFAULT NULL,
  p_reopen_reason TEXT DEFAULT NULL,
  p_expected_version INT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_task tasks;
  v_incomplete_required_checklists INT;
  v_old_status VARCHAR(50);
BEGIN
  -- Lock task row for concurrency control
  SELECT * INTO v_task
  FROM tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND: Task % does not exist.', p_task_id;
  END IF;

  -- Optimistic concurrency check if version provided
  IF p_expected_version IS NOT NULL AND v_task.version <> p_expected_version THEN
    RAISE EXCEPTION 'TASK_CONFLICT: Concurrency collision. Client version % does not match server version %.',
      p_expected_version, v_task.version;
  END IF;

  v_old_status := v_task.status;

  -- Validate Allowed Transitions:
  -- DRAFT -> ASSIGNED, CANCELED
  -- ASSIGNED -> ACCEPTED, IN_PROGRESS, CANCELED
  -- ACCEPTED -> IN_PROGRESS, CANCELED
  -- IN_PROGRESS -> BLOCKED, COMPLETED, CANCELED
  -- BLOCKED -> IN_PROGRESS, COMPLETED, CANCELED
  -- COMPLETED -> IN_PROGRESS (Reopened with reason)
  -- CANCELED -> (Terminal state, no transitions allowed)
  
  IF v_old_status = p_target_status THEN
    RETURN row_to_json(v_task);
  END IF;

  IF v_old_status = 'CANCELED' THEN
    RAISE EXCEPTION 'TASK_INVALID_STATUS_TRANSITION: Canceled tasks cannot transition to any other status.';
  END IF;

  IF v_old_status = 'DRAFT' AND p_target_status NOT IN ('ASSIGNED', 'CANCELED') THEN
    RAISE EXCEPTION 'TASK_INVALID_STATUS_TRANSITION: Cannot transition DRAFT directly to %.', p_target_status;
  END IF;

  IF v_old_status = 'ASSIGNED' AND p_target_status NOT IN ('ACCEPTED', 'IN_PROGRESS', 'CANCELED') THEN
    RAISE EXCEPTION 'TASK_INVALID_STATUS_TRANSITION: Invalid transition from ASSIGNED to %.', p_target_status;
  END IF;

  IF v_old_status = 'ACCEPTED' AND p_target_status NOT IN ('IN_PROGRESS', 'CANCELED') THEN
    RAISE EXCEPTION 'TASK_INVALID_STATUS_TRANSITION: Invalid transition from ACCEPTED to %.', p_target_status;
  END IF;

  IF v_old_status = 'IN_PROGRESS' AND p_target_status NOT IN ('BLOCKED', 'COMPLETED', 'CANCELED') THEN
    RAISE EXCEPTION 'TASK_INVALID_STATUS_TRANSITION: Invalid transition from IN_PROGRESS to %.', p_target_status;
  END IF;

  IF v_old_status = 'BLOCKED' AND p_target_status NOT IN ('IN_PROGRESS', 'COMPLETED', 'CANCELED') THEN
    RAISE EXCEPTION 'TASK_INVALID_STATUS_TRANSITION: Invalid transition from BLOCKED to %.', p_target_status;
  END IF;

  IF v_old_status = 'COMPLETED' AND p_target_status <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'TASK_INVALID_STATUS_TRANSITION: Completed tasks can only be reopened to IN_PROGRESS.';
  END IF;

  -- Validation: BLOCKED status requires non-empty reason
  IF p_target_status = 'BLOCKED' AND (p_blocked_reason IS NULL OR TRIM(p_blocked_reason) = '') THEN
    RAISE EXCEPTION 'TASK_INVALID_STATUS_TRANSITION: Transitioning to BLOCKED requires a non-empty blocked_reason.';
  END IF;

  -- Validation: COMPLETED status requires all required checklist items to be checked
  IF p_target_status = 'COMPLETED' THEN
    SELECT COUNT(*) INTO v_incomplete_required_checklists
    FROM task_checklists
    WHERE task_id = p_task_id
      AND is_required = true
      AND is_completed = false;

    IF v_incomplete_required_checklists > 0 THEN
      RAISE EXCEPTION 'TASK_CHECKLIST_INCOMPLETE: Cannot complete task with % unfinished required checklist items.',
        v_incomplete_required_checklists;
    END IF;
  END IF;

  -- Execute Task Status Update
  UPDATE tasks
  SET
    status = p_target_status,
    blocked_reason = CASE
      WHEN p_target_status = 'BLOCKED' THEN p_blocked_reason
      WHEN p_target_status = 'IN_PROGRESS' AND v_old_status = 'BLOCKED' THEN NULL
      ELSE blocked_reason
    END,
    version = version + 1,
    updated_at = NOW()
  WHERE id = p_task_id
  RETURNING * INTO v_task;

  -- Record in immutable Task Activity timeline
  INSERT INTO task_activities (
    task_id,
    organization_id,
    actor_id,
    action,
    details
  ) VALUES (
    v_task.id,
    v_task.organization_id,
    p_actor_id,
    CASE
      WHEN v_old_status = 'COMPLETED' AND p_target_status = 'IN_PROGRESS' THEN 'task.reopened'
      ELSE 'task.status_changed'
    END,
    jsonb_build_object(
      'from_status', v_old_status,
      'to_status', p_target_status,
      'blocked_reason', p_blocked_reason,
      'reopen_reason', p_reopen_reason,
      'version', v_task.version
    )
  );

  RETURN row_to_json(v_task);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. ROW-LEVEL SECURITY (RLS) FOR PHASE 04 ENTITIES
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams FORCE ROW LEVEL SECURITY;

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members FORCE ROW LEVEL SECURITY;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

ALTER TABLE task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checklists FORCE ROW LEVEL SECURITY;

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments FORCE ROW LEVEL SECURITY;

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments FORCE ROW LEVEL SECURITY;

ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activities FORCE ROW LEVEL SECURITY;

ALTER TABLE offline_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_mutations FORCE ROW LEVEL SECURITY;

-- Helper to check if user belongs to a specific team
CREATE OR REPLACE FUNCTION is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
      AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Policies for TEAMS
CREATE POLICY tenant_isolation_teams ON teams
  FOR ALL
  USING (
    organization_id = current_tenant_id() AND
    is_active_tenant_member(organization_id, auth.uid())
  );

-- Policies for TEAM MEMBERS
CREATE POLICY tenant_isolation_team_members ON team_members
  FOR ALL
  USING (
    organization_id = current_tenant_id() AND
    is_active_tenant_member(organization_id, auth.uid())
  );

-- Policies for TASKS
-- Select policy:
-- Owners, Admins, Managers: can see all tasks in tenant
-- Supervisors: can see tasks assigned to them or their supervised teams
-- Field Workers: can only see tasks assigned to them or their assigned teams
CREATE POLICY tenant_isolation_tasks_select ON tasks
  FOR SELECT
  USING (
    organization_id = current_tenant_id() AND
    is_active_tenant_member(organization_id, auth.uid()) AND
    (
      has_tenant_role(organization_id, auth.uid(), ARRAY['OWNER', 'ADMIN', 'MANAGER']) OR
      assigned_to = auth.uid() OR
      (assigned_team IS NOT NULL AND is_team_member(assigned_team, auth.uid()))
    )
  );

CREATE POLICY tenant_isolation_tasks_manage ON tasks
  FOR ALL
  USING (
    organization_id = current_tenant_id() AND
    is_active_tenant_member(organization_id, auth.uid()) AND
    (
      has_tenant_role(organization_id, auth.uid(), ARRAY['OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR']) OR
      assigned_to = auth.uid()
    )
  );

-- Policies for CHECKLISTS, ATTACHMENTS, COMMENTS, ACTIVITIES
CREATE POLICY tenant_isolation_checklists ON task_checklists
  FOR ALL
  USING (
    organization_id = current_tenant_id() AND
    is_active_tenant_member(organization_id, auth.uid())
  );

CREATE POLICY tenant_isolation_attachments ON task_attachments
  FOR ALL
  USING (
    organization_id = current_tenant_id() AND
    is_active_tenant_member(organization_id, auth.uid())
  );

CREATE POLICY tenant_isolation_comments ON task_comments
  FOR ALL
  USING (
    organization_id = current_tenant_id() AND
    is_active_tenant_member(organization_id, auth.uid())
  );

CREATE POLICY tenant_isolation_activities ON task_activities
  FOR SELECT
  USING (
    organization_id = current_tenant_id() AND
    is_active_tenant_member(organization_id, auth.uid())
  );

CREATE POLICY tenant_isolation_offline_mutations ON offline_mutations
  FOR ALL
  USING (
    organization_id = current_tenant_id() AND
    user_id = auth.uid()
  );
-- =============================================================================
-- Migration: 20260928000006_field_operations_engine.sql
-- Phase 05: Field Operations, Visits, GPS Verification & Proof of Work
-- =============================================================================

-- 1. GEOSPATIAL DISTANCE FUNCTION (HAVERSINE SPHERICAL DISTANCE)
-- Calculates distance in meters between two (lat, lon) coordinates on WGS-84 sphere (R = 6,371,000m)
CREATE OR REPLACE FUNCTION calculate_distance_meters(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  r CONSTANT DOUBLE PRECISION := 6371000.0; -- Earth mean radius in meters
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  -- If coordinates are identical, distance is zero
  IF lat1 = lat2 AND lon1 = lon2 THEN
    RETURN 0.0;
  END IF;

  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);

  a := sin(dlat / 2.0) * sin(dlat / 2.0) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon / 2.0) * sin(dlon / 2.0);

  -- Clamp a to [0.0, 1.0] to prevent NaN from floating point precision
  IF a > 1.0 THEN
    a := 1.0;
  END IF;

  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- 2. LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  allowed_radius_meters INT NOT NULL DEFAULT 100,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_locations_status CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  CONSTRAINT chk_locations_radius CHECK (allowed_radius_meters > 0 AND allowed_radius_meters <= 50000),
  CONSTRAINT chk_locations_latitude CHECK (latitude >= -90.0 AND latitude <= 90.0),
  CONSTRAINT chk_locations_longitude CHECK (longitude >= -180.0 AND longitude <= 180.0)
);

CREATE INDEX IF NOT EXISTS idx_locations_tenant_status ON locations (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_locations_coords ON locations (latitude, longitude);

DROP TRIGGER IF EXISTS trg_locations_timestamp ON locations;
CREATE TRIGGER trg_locations_timestamp
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 3. VISITS TABLE
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  assigned_to UUID,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
  version INT NOT NULL DEFAULT 1,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_visits_status CHECK (
    status IN ('SCHEDULED', 'READY', 'EN_ROUTE', 'CHECKED_IN', 'IN_PROGRESS', 'CHECKED_OUT', 'COMPLETED', 'CANCELED', 'MISSED')
  ),
  CONSTRAINT chk_visits_schedule CHECK (
    scheduled_end IS NULL OR scheduled_end >= scheduled_start
  )
);

CREATE INDEX IF NOT EXISTS idx_visits_tenant_status ON visits (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_visits_tenant_assignee ON visits (organization_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_visits_tenant_location ON visits (organization_id, location_id);
CREATE INDEX IF NOT EXISTS idx_visits_tenant_task ON visits (organization_id, task_id);
CREATE INDEX IF NOT EXISTS idx_visits_tenant_schedule ON visits (organization_id, scheduled_start);

DROP TRIGGER IF EXISTS trg_visits_timestamp ON visits;
CREATE TRIGGER trg_visits_timestamp
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 4. VISIT CHECK-INS (IMMUTABLE LOG OF ARRIVAL)
CREATE TABLE IF NOT EXISTS visit_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION NOT NULL,
  distance_meters DOUBLE PRECISION NOT NULL,
  verification_result VARCHAR(50) NOT NULL DEFAULT 'VALID',
  is_exception BOOLEAN NOT NULL DEFAULT false,
  exception_reason TEXT,
  client_captured_at TIMESTAMPTZ NOT NULL,
  server_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_visit_checkin UNIQUE (visit_id),
  CONSTRAINT chk_checkin_coords CHECK (latitude >= -90.0 AND latitude <= 90.0 AND longitude >= -180.0 AND longitude <= 180.0),
  CONSTRAINT chk_checkin_result CHECK (
    verification_result IN ('VALID', 'OUTSIDE_RADIUS', 'LOW_ACCURACY', 'LOCATION_UNAVAILABLE', 'STALE_LOCATION', 'PERMISSION_DENIED')
  )
);

CREATE INDEX IF NOT EXISTS idx_checkins_tenant ON visit_checkins (organization_id);
CREATE INDEX IF NOT EXISTS idx_checkins_worker ON visit_checkins (worker_id);

-- 5. VISIT CHECK-OUTS (IMMUTABLE LOG OF DEPARTURE)
CREATE TABLE IF NOT EXISTS visit_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION NOT NULL,
  distance_meters DOUBLE PRECISION,
  verification_result VARCHAR(50) NOT NULL DEFAULT 'VALID',
  notes TEXT,
  client_captured_at TIMESTAMPTZ NOT NULL,
  server_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_visit_checkout UNIQUE (visit_id),
  CONSTRAINT chk_checkout_coords CHECK (latitude >= -90.0 AND latitude <= 90.0 AND longitude >= -180.0 AND longitude <= 180.0),
  CONSTRAINT chk_checkout_result CHECK (
    verification_result IN ('VALID', 'OUTSIDE_RADIUS', 'LOW_ACCURACY', 'LOCATION_UNAVAILABLE', 'STALE_LOCATION', 'PERMISSION_DENIED')
  )
);

CREATE INDEX IF NOT EXISTS idx_checkouts_tenant ON visit_checkouts (organization_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_worker ON visit_checkouts (worker_id);

-- 6. VISIT PROOFS (ATTACHMENTS, NOTES, SIGNATURES)
CREATE TABLE IF NOT EXISTS visit_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  proof_type VARCHAR(50) NOT NULL DEFAULT 'PHOTO',
  storage_path TEXT,
  file_name VARCHAR(255),
  mime_type VARCHAR(100),
  file_size_bytes BIGINT,
  notes TEXT,
  signer_name VARCHAR(100),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_proof_type CHECK (proof_type IN ('PHOTO', 'NOTE', 'SIGNATURE', 'CHECKLIST'))
);

CREATE INDEX IF NOT EXISTS idx_visit_proofs_visit ON visit_proofs (visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_proofs_tenant ON visit_proofs (organization_id);

-- 7. VISIT ACTIVITIES (APPEND-ONLY USER-FACING TIMELINE)
CREATE TABLE IF NOT EXISTS visit_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_activities_visit ON visit_activities (visit_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_visit_activities_tenant ON visit_activities (organization_id);

-- Enforce Append-Only Immutability on visit_activities
CREATE OR REPLACE FUNCTION prevent_visit_activity_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'visit_activities table is append-only. Updates and deletions are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_visit_activity_mod ON visit_activities;
CREATE TRIGGER trg_prevent_visit_activity_mod
  BEFORE UPDATE OR DELETE ON visit_activities
  FOR EACH ROW EXECUTE FUNCTION prevent_visit_activity_modification();

-- 8. LOCATION EVENTS (AUDITABLE OPERATIONAL LOCATION LOG)
CREATE TABLE IF NOT EXISTS location_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL,
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'GPS',
  client_captured_at TIMESTAMPTZ NOT NULL,
  server_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_location_events_type CHECK (
    event_type IN ('CHECK_IN', 'CHECK_OUT', 'MANUAL_VERIFICATION', 'EXCEPTION_OVERRIDE')
  ),
  CONSTRAINT chk_location_events_coords CHECK (latitude >= -90.0 AND latitude <= 90.0 AND longitude >= -180.0 AND longitude <= 180.0)
);

CREATE INDEX IF NOT EXISTS idx_location_events_tenant ON location_events (organization_id);
CREATE INDEX IF NOT EXISTS idx_location_events_worker ON location_events (worker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_events_visit ON location_events (visit_id);

-- 9. AUTHORITATIVE STORED PROCEDURES

-- Procedure A: record_visit_checkin
CREATE OR REPLACE FUNCTION record_visit_checkin(
  p_visit_id UUID,
  p_worker_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION,
  p_client_captured_at TIMESTAMPTZ,
  p_exception_reason TEXT DEFAULT NULL,
  p_device_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_visit RECORD;
  v_location RECORD;
  v_distance DOUBLE PRECISION;
  v_result VARCHAR(50);
  v_is_exception BOOLEAN := false;
  v_checkin RECORD;
BEGIN
  -- 1. Fetch visit
  SELECT * INTO v_visit FROM visits WHERE id = p_visit_id;
  IF v_visit IS NULL THEN
    RAISE EXCEPTION 'VISIT_NOT_FOUND: Visit % does not exist.', p_visit_id;
  END IF;

  -- 2. Verify state: visit must be in SCHEDULED, READY, or EN_ROUTE
  IF v_visit.status NOT IN ('SCHEDULED', 'READY', 'EN_ROUTE') THEN
    RAISE EXCEPTION 'VISIT_INVALID_STATUS_TRANSITION: Cannot check in to visit in status %.', v_visit.status;
  END IF;

  -- 3. Fetch location
  SELECT * INTO v_location FROM locations WHERE id = v_visit.location_id;
  IF v_location IS NULL THEN
    RAISE EXCEPTION 'LOCATION_NOT_FOUND: Assigned location does not exist.';
  END IF;

  -- 4. Calculate Geodesic Distance
  v_distance := calculate_distance_meters(
    p_latitude, p_longitude,
    v_location.latitude, v_location.longitude
  );

  -- 5. Determine Verification Result
  IF p_accuracy > 150.0 THEN
    v_result := 'LOW_ACCURACY';
  ELSIF v_distance <= v_location.allowed_radius_meters THEN
    v_result := 'VALID';
  ELSE
    v_result := 'OUTSIDE_RADIUS';
  END IF;

  -- 6. Outside Radius / Exception Handling
  IF v_result <> 'VALID' THEN
    IF p_exception_reason IS NULL OR TRIM(p_exception_reason) = '' THEN
      RAISE EXCEPTION 'GEOFENCE_EXCEPTION: Worker is % meters from target (allowed: %m). Must provide exception reason.',
        round(v_distance::numeric, 1), v_location.allowed_radius_meters;
    ELSE
      v_is_exception := true;
    END IF;
  END IF;

  -- 7. Record Check-In
  INSERT INTO visit_checkins (
    visit_id,
    organization_id,
    worker_id,
    latitude,
    longitude,
    accuracy_meters,
    distance_meters,
    verification_result,
    is_exception,
    exception_reason,
    client_captured_at,
    server_received_at,
    device_metadata
  ) VALUES (
    v_visit.id,
    v_visit.organization_id,
    p_worker_id,
    p_latitude,
    p_longitude,
    p_accuracy,
    v_distance,
    v_result,
    v_is_exception,
    p_exception_reason,
    p_client_captured_at,
    NOW(),
    p_device_metadata
  ) RETURNING * INTO v_checkin;

  -- 8. Log Location Event
  INSERT INTO location_events (
    organization_id,
    worker_id,
    visit_id,
    event_type,
    latitude,
    longitude,
    accuracy_meters,
    source,
    client_captured_at,
    server_received_at
  ) VALUES (
    v_visit.organization_id,
    p_worker_id,
    v_visit.id,
    CASE WHEN v_is_exception THEN 'EXCEPTION_OVERRIDE' ELSE 'CHECK_IN' END,
    p_latitude,
    p_longitude,
    p_accuracy,
    'GPS',
    p_client_captured_at,
    NOW()
  );

  -- 9. Update Visit Status
  UPDATE visits
  SET
    status = 'CHECKED_IN',
    version = version + 1,
    updated_at = NOW()
  WHERE id = p_visit_id;

  -- 10. Record Activity
  INSERT INTO visit_activities (
    visit_id,
    organization_id,
    actor_id,
    action,
    details
  ) VALUES (
    v_visit.id,
    v_visit.organization_id,
    p_worker_id,
    'visit.checked_in',
    jsonb_build_object(
      'distance_meters', v_distance,
      'allowed_radius', v_location.allowed_radius_meters,
      'verification_result', v_result,
      'is_exception', v_is_exception,
      'exception_reason', p_exception_reason
    )
  );

  RETURN row_to_json(v_checkin);
END;
$$ LANGUAGE plpgsql;

-- Procedure B: transition_visit_status
CREATE OR REPLACE FUNCTION transition_visit_status(
  p_visit_id UUID,
  p_target_status VARCHAR(50),
  p_actor_id UUID,
  p_expected_version INT DEFAULT NULL,
  p_cancel_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_visit RECORD;
  v_old_status VARCHAR(50);
  v_has_checkout BOOLEAN;
  v_proof_count INT;
BEGIN
  SELECT * INTO v_visit FROM visits WHERE id = p_visit_id FOR UPDATE;
  IF v_visit IS NULL THEN
    RAISE EXCEPTION 'VISIT_NOT_FOUND: Visit % does not exist.', p_visit_id;
  END IF;

  IF p_expected_version IS NOT NULL AND v_visit.version <> p_expected_version THEN
    RAISE EXCEPTION 'VISIT_CONFLICT: Concurrency collision. Client version % does not match server %.',
      p_expected_version, v_visit.version;
  END IF;

  v_old_status := v_visit.status;

  IF v_old_status = p_target_status THEN
    RETURN row_to_json(v_visit);
  END IF;

  IF v_old_status = 'CANCELED' THEN
    RAISE EXCEPTION 'VISIT_INVALID_STATUS_TRANSITION: Canceled visit cannot transition to any other status.';
  END IF;

  -- Transition Validation
  -- SCHEDULED -> READY, EN_ROUTE, CHECKED_IN, CANCELED, MISSED
  -- READY -> EN_ROUTE, CHECKED_IN, CANCELED, MISSED
  -- EN_ROUTE -> CHECKED_IN, CANCELED, MISSED
  -- CHECKED_IN -> IN_PROGRESS, CHECKED_OUT, CANCELED
  -- IN_PROGRESS -> CHECKED_OUT, CANCELED
  -- CHECKED_OUT -> COMPLETED, CANCELED
  -- COMPLETED -> (Terminal)
  
  IF v_old_status = 'SCHEDULED' AND p_target_status NOT IN ('READY', 'EN_ROUTE', 'CHECKED_IN', 'CANCELED', 'MISSED') THEN
    RAISE EXCEPTION 'VISIT_INVALID_STATUS_TRANSITION: SCHEDULED cannot transition to %.', p_target_status;
  END IF;

  IF v_old_status = 'READY' AND p_target_status NOT IN ('EN_ROUTE', 'CHECKED_IN', 'CANCELED', 'MISSED') THEN
    RAISE EXCEPTION 'VISIT_INVALID_STATUS_TRANSITION: READY cannot transition to %.', p_target_status;
  END IF;

  IF v_old_status = 'EN_ROUTE' AND p_target_status NOT IN ('CHECKED_IN', 'CANCELED', 'MISSED') THEN
    RAISE EXCEPTION 'VISIT_INVALID_STATUS_TRANSITION: EN_ROUTE cannot transition to %.', p_target_status;
  END IF;

  IF v_old_status = 'CHECKED_IN' AND p_target_status NOT IN ('IN_PROGRESS', 'CHECKED_OUT', 'CANCELED') THEN
    RAISE EXCEPTION 'VISIT_INVALID_STATUS_TRANSITION: CHECKED_IN cannot transition to %.', p_target_status;
  END IF;

  IF v_old_status = 'IN_PROGRESS' AND p_target_status NOT IN ('CHECKED_OUT', 'CANCELED') THEN
    RAISE EXCEPTION 'VISIT_INVALID_STATUS_TRANSITION: IN_PROGRESS cannot transition to %.', p_target_status;
  END IF;

  IF v_old_status = 'CHECKED_OUT' AND p_target_status NOT IN ('COMPLETED', 'CANCELED') THEN
    RAISE EXCEPTION 'VISIT_INVALID_STATUS_TRANSITION: CHECKED_OUT cannot transition to %.', p_target_status;
  END IF;

  IF v_old_status = 'COMPLETED' THEN
    RAISE EXCEPTION 'VISIT_INVALID_STATUS_TRANSITION: COMPLETED is a terminal state.';
  END IF;

  -- Completion Requirement: Check-out must exist before COMPLETED
  IF p_target_status = 'COMPLETED' THEN
    SELECT EXISTS (SELECT 1 FROM visit_checkouts WHERE visit_id = p_visit_id) INTO v_has_checkout;
    IF NOT v_has_checkout THEN
      RAISE EXCEPTION 'VISIT_PROOF_INCOMPLETE: Cannot complete visit without recording check-out.';
    END IF;
  END IF;

  UPDATE visits
  SET
    status = p_target_status,
    version = version + 1,
    updated_at = NOW()
  WHERE id = p_visit_id
  RETURNING * INTO v_visit;

  INSERT INTO visit_activities (
    visit_id,
    organization_id,
    actor_id,
    action,
    details
  ) VALUES (
    v_visit.id,
    v_visit.organization_id,
    p_actor_id,
    'visit.status_changed',
    jsonb_build_object(
      'from_status', v_old_status,
      'to_status', p_target_status,
      'cancel_reason', p_cancel_reason
    )
  );

  RETURN row_to_json(v_visit);
END;
$$ LANGUAGE plpgsql;

-- 10. ROW-LEVEL SECURITY (RLS) POLICIES
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_events ENABLE ROW LEVEL SECURITY;

-- Locations RLS
DROP POLICY IF EXISTS p_locations_tenant ON locations;
CREATE POLICY p_locations_tenant ON locations
  FOR ALL TO authenticated
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

-- Visits RLS: Field workers see only assigned visits; supervisors/managers see tenant visits
DROP POLICY IF EXISTS p_visits_tenant ON visits;
CREATE POLICY p_visits_tenant ON visits
  FOR ALL TO authenticated
  USING (
    organization_id = current_tenant_id()
    AND (
      current_user_role() IN ('OWNER', 'ADMIN', 'MANAGER')
      OR (current_user_role() = 'SUPERVISOR')
      OR (current_user_role() = 'FIELD_WORKER' AND assigned_to = auth.uid())
    )
  )
  WITH CHECK (
    organization_id = current_tenant_id()
    AND current_user_role() IN ('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR')
  );

-- Check-ins RLS
DROP POLICY IF EXISTS p_checkins_tenant ON visit_checkins;
CREATE POLICY p_checkins_tenant ON visit_checkins
  FOR ALL TO authenticated
  USING (
    organization_id = current_tenant_id()
    AND (
      current_user_role() IN ('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR')
      OR worker_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = current_tenant_id()
    AND worker_id = auth.uid()
  );

-- Check-outs RLS
DROP POLICY IF EXISTS p_checkouts_tenant ON visit_checkouts;
CREATE POLICY p_checkouts_tenant ON visit_checkouts
  FOR ALL TO authenticated
  USING (
    organization_id = current_tenant_id()
    AND (
      current_user_role() IN ('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR')
      OR worker_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = current_tenant_id()
    AND worker_id = auth.uid()
  );

-- Proofs RLS
DROP POLICY IF EXISTS p_proofs_tenant ON visit_proofs;
CREATE POLICY p_proofs_tenant ON visit_proofs
  FOR ALL TO authenticated
  USING (
    organization_id = current_tenant_id()
    AND (
      current_user_role() IN ('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR')
      OR created_by = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = current_tenant_id()
  );

-- Activities RLS
DROP POLICY IF EXISTS p_visit_activities_tenant ON visit_activities;
CREATE POLICY p_visit_activities_tenant ON visit_activities
  FOR SELECT TO authenticated
  USING (
    organization_id = current_tenant_id()
    AND (
      current_user_role() IN ('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR')
      OR EXISTS (SELECT 1 FROM visits WHERE id = visit_activities.visit_id AND assigned_to = auth.uid())
    )
  );

-- Location Events RLS (Sensitive - Only Managers, Admins, and Owners can audit all events; workers see own)
DROP POLICY IF EXISTS p_location_events_tenant ON location_events;
CREATE POLICY p_location_events_tenant ON location_events
  FOR ALL TO authenticated
  USING (
    organization_id = current_tenant_id()
    AND (
      current_user_role() IN ('OWNER', 'ADMIN', 'MANAGER')
      OR (current_user_role() = 'SUPERVISOR')
      OR worker_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = current_tenant_id()
    AND worker_id = auth.uid()
  );
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
-- FieldOps Phase 09: Security, QA & Production Hardening
-- Migration: 20260928000009_storage_security_and_hardening.sql

-- =============================================================================
-- 1. STORAGE BUCKET CREATION (PRIVATE, STRICT MIME & SIZE RESTRICTIONS)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'fieldops-media',
    'fieldops-media',
    false, -- Strictly private; pre-signed URLs required
    15728640, -- 15MB limit
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'image/svg+xml'
    ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'image/svg+xml'
    ]::text[];

-- =============================================================================
-- 2. STORAGE ROW-LEVEL SECURITY POLICIES (MULTI-TENANT PATH ISOLATION)
-- Object path convention: {organization_id}/{category}/{entity_id}/{file_id}.ext
-- =============================================================================

-- Ensure RLS is active on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2.1 SELECT (Read) Policy: Users can only read objects in their active tenant path
DROP POLICY IF EXISTS "storage_tenant_read_isolation" ON storage.objects;
CREATE POLICY "storage_tenant_read_isolation"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'fieldops-media'
        AND (storage.foldername(name))[1] = public.current_tenant_id()::text
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = public.current_tenant_id()
              AND m.user_id = auth.uid()
              AND m.status = 'ACTIVE'
        )
    );

-- 2.2 INSERT (Upload) Policy: Users can only upload objects into their active tenant path
DROP POLICY IF EXISTS "storage_tenant_upload_isolation" ON storage.objects;
CREATE POLICY "storage_tenant_upload_isolation"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'fieldops-media'
        AND (storage.foldername(name))[1] = public.current_tenant_id()::text
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = public.current_tenant_id()
              AND m.user_id = auth.uid()
              AND m.status = 'ACTIVE'
        )
    );

-- 2.3 DELETE Policy: Only Owner or Admin can delete operational media objects
DROP POLICY IF EXISTS "storage_tenant_delete_restricted" ON storage.objects;
CREATE POLICY "storage_tenant_delete_restricted"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'fieldops-media'
        AND (storage.foldername(name))[1] = public.current_tenant_id()::text
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = public.current_tenant_id()
              AND m.user_id = auth.uid()
              AND m.role IN ('OWNER', 'ADMIN')
              AND m.status = 'ACTIVE'
        )
    );
