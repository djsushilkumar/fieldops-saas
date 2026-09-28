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
