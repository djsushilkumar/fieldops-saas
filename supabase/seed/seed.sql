-- =============================================================================
-- FieldOps Deterministic Development Seed Data
-- =============================================================================
-- IMPORTANT:
-- This file contains strictly synthetic test fixtures for local development.
-- NEVER run this seed against staging or production databases.
-- =============================================================================

-- Deterministic UUIDs for development referencing
-- Tenant: Demo Operations Co.
INSERT INTO organizations (id, name, slug, subscription_tier, subscription_status, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Operations Co.',
  'demo-ops',
  'BUSINESS',
  'ACTIVE',
  '{"allowed_radius_meters": 100, "timezone": "America/New_York"}'
) ON CONFLICT (id) DO NOTHING;

-- Secondary Tenant: Isolated Competitor Inc. (Used for cross-tenant testing)
INSERT INTO organizations (id, name, slug, subscription_tier, subscription_status, settings)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Isolated Competitor Inc.',
  'isolated-competitor',
  'STARTER',
  'ACTIVE',
  '{"allowed_radius_meters": 150, "timezone": "UTC"}'
) ON CONFLICT (id) DO NOTHING;

-- Synthetic Memberships for Tenant 1
INSERT INTO memberships (id, organization_id, user_id, role, status)
VALUES
  -- Demo Owner
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'OWNER', 'ACTIVE'),
  -- Demo Admin
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'ADMIN', 'ACTIVE'),
  -- Demo Manager
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'MANAGER', 'ACTIVE'),
  -- Demo Supervisor
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'SUPERVISOR', 'ACTIVE'),
  -- Demo Field Worker
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', 'FIELD_WORKER', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Synthetic Profiles for Tenant 1
INSERT INTO profiles (id, user_id, email, full_name, display_name, phone, timezone)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'owner@demo-ops.com', 'Alice Owner', 'Alice', '+15551000001', 'America/New_York'),
  ('30000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'admin@demo-ops.com', 'Bob Admin', 'Bob', '+15551000002', 'America/New_York'),
  ('30000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'manager@demo-ops.com', 'Charlie Manager', 'Charlie', '+15551000003', 'America/New_York'),
  ('30000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', 'supervisor@demo-ops.com', 'Diana Supervisor', 'Diana', '+15551000004', 'America/New_York'),
  ('30000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000005', 'worker@demo-ops.com', 'Evan Worker', 'Evan', '+15551000005', 'America/New_York')
ON CONFLICT (id) DO NOTHING;

-- Synthetic Profile for Tenant 2 Admin
INSERT INTO profiles (id, user_id, email, full_name, display_name, phone, timezone)
VALUES
  ('30000000-0000-0000-0000-000000000099', 'e0000000-0000-0000-0000-000000000099', 'admin@competitor.com', 'Zara Competitor', 'Zara', '+15551000099', 'UTC')
ON CONFLICT (id) DO NOTHING;

-- Synthetic Pending Invitation for Tenant 1
INSERT INTO organization_invitations (id, organization_id, email, role, token_hash, status, expires_at, created_by)
VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'newhire@demo-ops.com',
    'FIELD_WORKER',
    -- SHA256 hash of 'demo-invitation-token-1234567890'
    'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3',
    'PENDING',
    NOW() + INTERVAL '7 days',
    'e0000000-0000-0000-0000-000000000001'
  )
ON CONFLICT (id) DO NOTHING;

-- Synthetic Membership for Tenant 2 (Tenant boundary test user)
INSERT INTO memberships (id, organization_id, user_id, role, status)
VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000099', 'ADMIN', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;


