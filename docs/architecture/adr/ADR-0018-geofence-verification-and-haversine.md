# ADR-0018: Geofence Verification and Native Haversine Distance Calculation

## Status
Accepted

## Context
FieldOps requires arrival and departure location verification to validate that field technicians are physically present at assigned customer sites when recording work. We evaluated two primary approaches for distance calculation and geofence evaluation:
1. **PostGIS PostgreSQL Extension**: Heavy native spatial extension with GEOMETRY/GEOGRAPHY types and spatial indexing.
2. **Native Haversine Formula**: Pure mathematical trigonometric calculation of great-circle distance between two coordinates on a spherical Earth (radius $R = 6,371,000$ meters).

Furthermore, field workers frequently operate in low-connectivity or offline environments where mobile devices must compute real-time proximity before network synchronization.

## Decision
1. **Pure Haversine Trigonometric Engine**: We implement the standard spherical Haversine formula across all three tiers:
   - **Database**: Pure SQL function `calculate_distance_meters(lat1, lon1, lat2, lon2)` executed inside stored procedures and PostgreSQL triggers without requiring PostGIS.
   - **Shared TypeScript**: `calculateHaversineDistance` in `@fieldops/types` for web management consoles and API gateway validation.
   - **Mobile Flutter**: `GeofenceService.calculateDistance` in Dart for immediate on-device proximity feedback.
2. **Three-Point Verification Policy**: Location verification evaluates:
   - **Proximity**: Distance must be $\le$ `allowed_radius_meters` (default 100m, range 10m to 50,000m).
   - **GPS Accuracy Degradation**: Rejects fixes where `accuracy_meters > 150m` with `LOW_ACCURACY` to prevent fraudulent or low-signal spoofing.
   - **Temporal Freshness**: Rejects GPS fixes older than 120 seconds (`STALE_LOCATION`) to ensure real-time presence.
3. **Structured Exception Handling**: Out-of-geofence check-ins are not silently dropped; technicians may submit an explicit `exception_reason` (e.g., street parking blockage, gate closure), flagging the event for supervisor review while preserving audit trails.

## Consequences
- **Positive**:
  - Eliminates PostGIS extension requirements, dramatically simplifying database hosting, migrations, and local test setups.
  - Sub-meter precision over standard operational radii (<50 km).
  - Perfect algorithmic parity between PostgreSQL, web TypeScript, and mobile Dart codebases.
- **Negative**:
  - Does not support complex non-circular polygon boundaries or multi-polygons (which are non-goals for Phase 05 V1).
- **Mitigation**:
  - Circular geofences completely satisfy customer site arrival verification. Complex geofences can be added in future enterprise phases if required.
