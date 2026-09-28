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
