# Arrival Check-in & Departure Check-out Specification

## 1. Overview

FieldOps requires explicit arrival and departure events for every field visit. These bookend records establish the technician's physical presence at the job site, substantiate billable labor hours, and generate immutable audit logs.

---

## 2. Arrival Check-in (`visit_checkins`)

### 2.1 Table Schema
- **`visit_id`**: Foreign key to `visits.id` (one check-in per visit).
- **`organization_id`**: Partition key for multi-tenant isolation.
- **`user_id`**: Technician recording arrival.
- **`latitude` / `longitude`**: Exact captured geographic coordinates.
- **`accuracy_meters`**: Device GPS accuracy radius at moment of capture.
- **`distance_meters`**: Computed distance from target location at time of check-in.
- **`is_override`**: Boolean flag set to `true` if arrival was recorded outside the geofence radius.
- **`override_reason`**: Mandatory human-readable explanation if `is_override = true`.
- **`verification_status`**: Result enum (`VALID`, `OUTSIDE_RADIUS`, `LOW_ACCURACY`, etc.).
- **`client_captured_at`**: Timestamp when coordinates were captured on device.
- **`server_recorded_at`**: Timestamp when server persisted the check-in.

### 2.2 Execution Flow
1. Technician approaches site and opens Visit details in mobile app.
2. Device requests single GPS fix and displays current proximity (e.g., "45m away — Inside Geofence").
3. Technician taps **Check In**.
4. If within geofence, check-in is saved, status updates to `CHECKED_IN`, and `actual_start` timestamp is set on `visits`.
5. If outside geofence, modal requests an **Exception Reason** before proceeding.

---

## 3. Departure Check-out (`visit_checkouts`)

### 3.1 Table Schema
- **`visit_id`**: Foreign key to `visits.id` (one checkout per visit).
- **`organization_id`**: Tenant isolation key.
- **`user_id`**: Technician recording departure.
- **`latitude` / `longitude`**: Geographic coordinates at departure.
- **`accuracy_meters`**: GPS accuracy at departure.
- **`distance_meters`**: Computed distance from target location.
- **`duration_seconds`**: Calculated operational duration $(\text{checkout\_time} - \text{checkin\_time})$ in seconds.
- **`notes`**: Optional technician checkout comments or summary.
- **`client_captured_at`**: Timestamp from device.
- **`server_recorded_at`**: Timestamp on server.

### 3.2 Execution Flow
1. Technician completes all on-site work, attaches necessary proofs, and taps **Check Out**.
2. Device captures departure GPS fix and calculates elapsed visit duration.
3. Visit status advances to `CHECKED_OUT`, and `actual_end` timestamp is recorded on `visits`.

---

## 4. Duration Calculation & Labor Metrics

- Duration is calculated on the server as:
  $$\text{duration\_seconds} = \text{EXTRACT(EPOCH FROM (checkout\_timestamp - checkin\_timestamp))}$$
- Prevents negative durations by validating `checkout_timestamp >= checkin_timestamp`.
- Available to dispatchers and managers on the Web console to evaluate technician time-on-site versus planned duration.
