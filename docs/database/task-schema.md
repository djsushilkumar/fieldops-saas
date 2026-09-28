# Database Architecture: Task Management Engine Schema

## 1. Schema Overview

The Task Management Engine schema is delivered in migration `supabase/migrations/20260928000005_task_management_engine.sql`. It introduces seven multi-tenant relational tables, strict Row-Level Security policies, an append-only protection trigger, and an authoritative lifecycle stored procedure.

---

## 2. Table Specifications

### 2.1 `teams` & `team_members`
- `teams`: `(id UUID PRIMARY KEY, organization_id UUID REFERENCES organizations, name TEXT, description TEXT, created_at, updated_at)`
- `team_members`: `(id UUID PRIMARY KEY, organization_id UUID, team_id UUID REFERENCES teams, user_id UUID REFERENCES auth.users, created_at)`
- Constraint: `UNIQUE (organization_id, team_id, user_id)`

### 2.2 `tasks`
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `title VARCHAR(255) NOT NULL`
- `description TEXT`
- `status VARCHAR(50) NOT NULL DEFAULT 'DRAFT'`
- `priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'`
- `created_by UUID NOT NULL REFERENCES auth.users(id)`
- `assigned_to UUID REFERENCES auth.users(id)`
- `assigned_team UUID REFERENCES teams(id)`
- `due_at TIMESTAMPTZ`
- `blocked_reason TEXT`
- `version INT NOT NULL DEFAULT 1`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 2.3 `task_checklists`
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `title VARCHAR(255) NOT NULL`
- `position INT NOT NULL DEFAULT 0`
- `is_required BOOLEAN NOT NULL DEFAULT TRUE`
- `is_completed BOOLEAN NOT NULL DEFAULT FALSE`
- `completed_at TIMESTAMPTZ`
- `completed_by UUID REFERENCES auth.users(id)`

### 2.4 `task_attachments`
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `storage_path TEXT NOT NULL`
- `file_name VARCHAR(255) NOT NULL`
- `mime_type VARCHAR(100) NOT NULL`
- `file_size_bytes BIGINT NOT NULL`
- `created_by UUID NOT NULL REFERENCES auth.users(id)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 2.5 `task_comments`
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `author_id UUID NOT NULL REFERENCES auth.users(id)`
- `content TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 2.6 `task_activities` (Append-Only Timeline)
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `actor_id UUID NOT NULL REFERENCES auth.users(id)`
- `action VARCHAR(100) NOT NULL`
- `details JSONB NOT NULL DEFAULT '{}'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 2.7 `offline_mutations` (Idempotent Queue Store)
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `user_id UUID NOT NULL REFERENCES auth.users(id)`
- `mutation_id VARCHAR(100) NOT NULL`
- `idempotency_key VARCHAR(255) NOT NULL`
- `entity_type VARCHAR(50) NOT NULL`
- `entity_id VARCHAR(100) NOT NULL`
- `action VARCHAR(50) NOT NULL`
- `payload JSONB NOT NULL DEFAULT '{}'`
- `status VARCHAR(20) NOT NULL DEFAULT 'PENDING'`
- `applied_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Constraint: `UNIQUE (tenant_id, idempotency_key)`

---

## 3. Stored Procedures & Triggers

### 3.1 Immutability Trigger: `prevent_task_activity_modification()`
- Attached as `BEFORE UPDATE OR DELETE ON task_activities`.
- Raises exception `task_activities table is append-only. Updates and deletions are strictly forbidden.`

### 3.2 Authoritative Lifecycle Procedure: `transition_task_status(...)`
- Validates current status vs target status.
- Validates that mandatory checklist items (`is_required = true`) are 100% completed before `COMPLETED` is allowed.
- Validates non-empty `blocked_reason` before `BLOCKED` is allowed.
- Verifies optimistic concurrency (`tasks.version = expected_version`).
- Increments `version = version + 1`.
- Automatically logs entry to `task_activities`.
