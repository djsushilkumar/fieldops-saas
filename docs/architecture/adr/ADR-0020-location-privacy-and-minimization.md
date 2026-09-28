# ADR-0020: Location Privacy, Minimization & Event-Driven Verification

## Status
Accepted

## Context
Operating a distributed field force necessitates verifying that personnel arrive at job sites. However, continuous GPS tracking ("breadcrumbs", live telematics, persistent fleet tracking) raises profound worker privacy concerns, triggers legal compliance burdens (e.g., GDPR Article 5(1)(c) data minimization, California CCPA), and severely degrades mobile device battery life. 

The FieldOps Product Requirements Document (`docs/product/PRD.md`) and V1 Scope (`docs/product/scope.md`) explicitly establish that continuous tracking and real-time fleet surveillance are out of scope.

## Decision
1. **Event-Driven Point-in-Time Capture**:
   - GPS coordinates are sampled exclusively when the user triggers an explicit operational action:
     - Visit Arrival Check-in (`visit.checkin`)
     - Visit Departure Check-out (`visit.checkout`)
     - Proof Capture attachment (Photos, Signatures)
     - Geofence Exception reporting (`exception_reason`)
2. **Zero Continuous Background Tracking**:
   - The FieldOps mobile app does NOT request "Always Allow" background location tracking permissions.
   - The app does not ping, stream, or log worker coordinates while workers are en route, on breaks, between tasks, or outside working hours.
3. **Data Minimization & Telemetry Boundaries**:
   - Only latitude, longitude, horizontal accuracy (meters), and timestamp are persisted.
   - No ambient device telemetry (Wi-Fi SSID scanning, Bluetooth beacon sniffing, device accelerometer/gyroscope motion profiling) is recorded.
4. **Immutable Audit Ledger (`location_events`)**:
   - Captured events are recorded in `location_events` with tenant isolation (`tenant_id`), actor identity, event type, and verification result (`VALID`, `OUTSIDE_RADIUS`, `LOW_ACCURACY`, etc.).
   - Access to raw location events is restricted to authorized supervisors, managers, and tenant audit inspectors (`LOCATION_EVENT_VIEW`).
5. **Transparency & Consent**:
   - The mobile interface provides immediate visual feedback regarding the worker's distance from the target geofence and clearly informs them when a location sample is being submitted for arrival confirmation.

## Consequences
- **Positive**:
  - Full adherence to data minimization and privacy regulations.
  - Minimal mobile battery consumption and network bandwidth usage.
  - High worker trust and operational transparency.
- **Negative**:
  - Does not support real-time vehicle map tracking or dispatch based on current road positions (non-goals for V1).
- **Mitigation**:
  - Future fleet telematics integrations can be implemented as opt-in enterprise add-ons with separate organizational consent if authorized.
