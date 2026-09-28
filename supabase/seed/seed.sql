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

-- Synthetic Teams for Tenant 1
INSERT INTO teams (id, organization_id, name, description)
VALUES
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'North District HVAC Crew', 'Commercial heating and cooling operations')
ON CONFLICT (id) DO NOTHING;

-- Bind Diana Supervisor and Evan Worker to Team 1
INSERT INTO team_members (id, organization_id, team_id, user_id)
VALUES
  ('51000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004'),
  ('51000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005')
ON CONFLICT (id) DO NOTHING;

-- Synthetic Tasks for Tenant 1
INSERT INTO tasks (id, organization_id, title, description, status, priority, created_by, assigned_to, assigned_team, due_at)
VALUES
  (
    '60000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Inspect Main Compressor & Pressure Valves',
    'Perform bi-annual preventive maintenance on commercial chillers.',
    'ASSIGNED',
    'HIGH',
    'e0000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000005',
    '50000000-0000-0000-0000-000000000001',
    NOW() + INTERVAL '2 days'
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Calibrate Sensor Arrays at Station 4',
    'Routine diagnostic check on temperature telemetry nodes.',
    'IN_PROGRESS',
    'MEDIUM',
    'e0000000-0000-0000-0000-000000000003',
    'e0000000-0000-0000-0000-000000000005',
    '50000000-0000-0000-0000-000000000001',
    NOW() + INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- Synthetic Checklist for Task 1
INSERT INTO task_checklists (id, task_id, organization_id, title, position, is_required, is_completed)
VALUES
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Lock out electrical breaker', 0, true, true),
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Check refrigerant oil levels', 1, true, false),
  ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Log gauge pressure values', 2, false, false)
ON CONFLICT (id) DO NOTHING;

-- Phase 05: Synthetic Locations
INSERT INTO locations (id, organization_id, name, address, latitude, longitude, allowed_radius_meters, status, created_by)
VALUES
  (
    '80000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Substation Alpha - Industrial Park',
    '100 Industrial Parkway, San Francisco, CA',
    37.7749,
    -122.4194,
    150,
    'ACTIVE',
    'e0000000-0000-0000-0000-000000000001'
  ),
  (
    '80000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Commercial Tower 4 - Rooftop HVAC',
    '450 Mission St, San Francisco, CA',
    37.7833,
    -122.4167,
    100,
    'ACTIVE',
    'e0000000-0000-0000-0000-000000000001'
  ),
  (
    '80000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    'Tenant 2 Primary Data Center',
    '1 Wall St, New York, NY',
    40.7128,
    -74.0060,
    100,
    'ACTIVE',
    'e0000000-0000-0000-0000-000000000006'
  )
ON CONFLICT (id) DO NOTHING;

-- Phase 05: Synthetic Visits
INSERT INTO visits (id, organization_id, location_id, task_id, assigned_to, scheduled_start, scheduled_end, status, created_by)
VALUES
  (
    '90000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000004',
    NOW() + INTERVAL '2 hours',
    NOW() + INTERVAL '4 hours',
    'READY',
    'e0000000-0000-0000-0000-000000000002'
  ),
  (
    '90000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000002',
    NULL,
    'e0000000-0000-0000-0000-000000000005',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '1 hour',
    'CHECKED_IN',
    'e0000000-0000-0000-0000-000000000003'
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Attendance Records
INSERT INTO public.attendance_records (
    id,
    organization_id,
    user_id,
    date,
    check_in_at,
    check_out_at,
    check_in_latitude,
    check_in_longitude,
    check_in_accuracy_meters,
    status,
    duration_seconds,
    notes,
    is_manually_adjusted,
    adjustment_reason,
    adjusted_by_user_id,
    adjusted_at
) VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000004',
    CURRENT_DATE,
    NOW() - INTERVAL '3 hours',
    NULL,
    37.7749,
    -122.4194,
    12.5,
    'CLOCKED_IN',
    NULL,
    'Started field shift at HQ depot.',
    false,
    NULL,
    NULL,
    NULL
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000005',
    CURRENT_DATE - INTERVAL '1 day',
    (CURRENT_DATE - INTERVAL '1 day') + TIME '08:00:00',
    (CURRENT_DATE - INTERVAL '1 day') + TIME '16:30:00',
    37.7749,
    -122.4194,
    10.0,
    'CLOCKED_OUT',
    30600,
    'Full day dispatch completed.',
    false,
    NULL,
    NULL,
    NULL
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000004',
    CURRENT_DATE - INTERVAL '2 days',
    (CURRENT_DATE - INTERVAL '2 days') + TIME '08:30:00',
    (CURRENT_DATE - INTERVAL '2 days') + TIME '17:00:00',
    37.7749,
    -122.4194,
    15.0,
    'CORRECTED',
    30600,
    '[Manual Adjustment] Adjusted missed clock-out due to cell tower outage.',
    true,
    'Adjusted missed clock-out due to cell tower outage.',
    'e0000000-0000-0000-0000-000000000002',
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Worker Activities
INSERT INTO public.worker_activities (
    id,
    organization_id,
    user_id,
    activity_type,
    title,
    description,
    metadata,
    created_at
) VALUES
  (
    'b0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000004',
    'ATTENDANCE_CHECKIN',
    'Clocked In for Workday',
    'Recorded attendance check-in via mobile application.',
    '{"has_location": true}'::jsonb,
    NOW() - INTERVAL '3 hours'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000004',
    'VISIT_EN_ROUTE',
    'En Route to Location',
    'Departed for Mission District Substation #4.',
    '{"visit_id": "90000000-0000-0000-0000-000000000001"}'::jsonb,
    NOW() - INTERVAL '2 hours'
  )
ON CONFLICT (id) DO NOTHING;




