# FieldOps — PostgreSQL Row-Level Security (RLS) Specification

---

## 1. RLS Strategy

PostgreSQL Row-Level Security is enabled and **forced** (`FORCE ROW LEVEL SECURITY`) on all tenant tables. This guarantees that even if a table owner or connection executes queries, RLS policies are applied.

---

## 2. Policy Matrix for Phase 03 Entities

### 2.1. `organizations` Table
```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

-- Select: Members can only see their own active organizations
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

-- Update: Only OWNER or ADMIN can modify organization settings
CREATE POLICY tenant_update_organizations ON organizations
  FOR UPDATE
  USING (has_tenant_role(id, auth.uid(), ARRAY['OWNER', 'ADMIN']));
```

### 2.2. `memberships` Table
```sql
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

-- Select: Only active members of the tenant can list memberships
CREATE POLICY tenant_isolation_memberships ON memberships
  FOR SELECT
  USING (
    organization_id = current_tenant_id() AND
    is_active_tenant_member(organization_id, auth.uid())
  );

-- Mutations: Only OWNER or ADMIN can invite, edit, or remove members
CREATE POLICY tenant_manage_memberships ON memberships
  FOR ALL
  USING (
    organization_id = current_tenant_id() AND
    has_tenant_role(organization_id, auth.uid(), ARRAY['OWNER', 'ADMIN'])
  );
```

### 2.3. `profiles` Table
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

-- Select: User can see own profile, or co-members in an active shared organization
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

-- Update: User can only update their own profile
CREATE POLICY profiles_update_policy ON profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### 2.4. `organization_invitations` Table
```sql
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations FORCE ROW LEVEL SECURITY;

-- Only OWNER and ADMIN can view/manage pending invitations
CREATE POLICY tenant_invitations_policy ON organization_invitations
  FOR ALL
  USING (
    organization_id = current_tenant_id() AND
    has_tenant_role(organization_id, auth.uid(), ARRAY['OWNER', 'ADMIN'])
  );
```

### 2.5. `audit_logs` Table
```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- Read-only: Scoped strictly to current tenant, accessible only to OWNER and ADMIN
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  FOR SELECT
  USING (
    organization_id = current_tenant_id() AND
    has_tenant_role(organization_id, auth.uid(), ARRAY['OWNER', 'ADMIN'])
  );
```
