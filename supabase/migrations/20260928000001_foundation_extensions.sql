-- =============================================================================
-- Migration: 20260928000001_foundation_extensions.sql
-- Phase 02 Foundation: Essential PostgreSQL extensions for FieldOps.
-- =============================================================================

-- Enable cryptographic functions (UUID generation, hashing)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for high-accuracy geodesic distance and spatial indexing
CREATE EXTENSION IF NOT EXISTS "postgis";
