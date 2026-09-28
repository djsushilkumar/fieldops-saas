# Workforce Attendance & Shift Tracking

## 1. Overview

FieldOps includes an integrated Workforce Attendance and Shift Tracking engine. It gives operations managers real-time visibility into who is on duty, when shifts began, GPS coordinates at clock-in/out, and cumulative working hours.

## 2. Architecture & Data Model

Workforce attendance is driven by two core tables:
1. `attendance_records`:
   - `id`: UUID (Primary Key)
   - `organization_id`: UUID (Multi-tenant partition FK)
   - `user_id`: UUID (Worker profile FK)
   - `date`: DATE (Workday date)
   - `check_in_at`: TIMESTAMPTZ (Clock-in timestamp)
   - `check_out_at`: TIMESTAMPTZ (Clock-out timestamp, nullable while active)
   - `check_in_latitude` / `check_in_longitude` / `check_in_accuracy_meters`: Point-in-time GPS arrival fix
   - `check_out_latitude` / `check_out_longitude` / `check_out_accuracy_meters`: Departure GPS fix
   - `status`: Enum (`CLOCKED_IN`, `ON_BREAK`, `CLOCKED_OUT`, `CORRECTED`)
   - `duration_seconds`: Computed duty duration in seconds
   - `is_manually_adjusted`: Boolean flag
   - `adjustment_reason`: Mandatory justification if modified
   - `adjusted_by_user_id`: Manager FK
2. `worker_activities`:
   - Append-only event ledger logging every clock-in, clock-out, task transition, and visit event.
   - Protected against modification by database trigger `prevent_worker_activity_modification()`.

## 3. Platform Parity

- **Web Application**:
  - Live Attendance Board at `/attendance`.
  - Metrics cards: Active Technicians on Duty, Completed Shifts Today, Cumulative Duty Time, and Manual Corrections.
  - Date and status filters.
  - "Adjust Shift" modal with compliance warning and mandatory 10-char justification.
- **Mobile Application**:
  - `AttendanceCard` positioned on Home Screen with duty status badge (`ON DUTY` / `OFF DUTY`) and real-time digital stopwatch.
  - Point-in-time GPS acquisition snapshot upon clock-in and clock-out.
  - Confirmation dialog with warning when active tasks or visits are in progress.
  - Dedicated `AttendanceScreen` displaying daily shift history and adjustment details.
  - Durable `OfflineMutationQueue` integration (`attendance.clock_in` and `attendance.clock_out`).
