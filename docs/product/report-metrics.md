# FieldOps Report Metrics & Calculation Formulas

This document defines the mathematical formulas and operational definitions for all metrics surfaced across FieldOps Operational Reports.

---

## 1. Task Report Formulas

### 1.1 Task Completion Rate
- **Definition**: The proportion of tasks completed compared to all active tasks within the selected reporting date window.
- **Formula**:
  $$\text{Task Completion Rate} = \begin{cases} 
  0\%, & \text{if } \text{Total Active Tasks} = 0 \\
  \min\left(100\%, \text{round}\left(\frac{\text{Completed Tasks}}{\text{Total Active Tasks}} \times 100\right)\right), & \text{otherwise}
  \end{cases}$$
- **Active Tasks**: Excludes `CANCELED` tasks from the denominator.

### 1.2 Overdue Rate
- **Formula**:
  $$\text{Overdue Rate} = \frac{\text{Overdue Tasks}}{\text{Total Active Tasks}} \times 100$$

---

## 2. Visit Report Formulas

### 2.1 Visit Completion Rate
- **Formula**:
  $$\text{Visit Completion Rate} = \frac{\text{Completed Visits}}{\text{Total Scheduled Visits}} \times 100$$
- **Scheduled Visits**: Visits with status not equal to `CANCELED`.

### 2.2 Geofence Verification Rate
- **Definition**: Percentage of recorded check-ins where the worker's GPS fix was mathematically confirmed to fall within the customer location's geofence radius with acceptable accuracy.
- **Formula**:
  $$\text{Verification Rate} = \frac{|\{ v \in \text{Visits} \mid v.\text{checkin}.\text{verificationResult} = \text{VALID} \}|}{|\{ v \in \text{Visits} \mid v.\text{checkin} \neq \text{null} \}|} \times 100$$

---

## 3. Attendance Report Formulas

### 3.1 Total Duty Hours
- **Definition**: Sum of all shift durations recorded in seconds for completed shifts within the window, converted to fractional hours.
- **Formula**:
  $$\text{Total Duty Hours} = \sum_{s \in \text{Shifts}} \frac{s.\text{durationSeconds}}{3600}$$

### 3.2 Shift Adjustment Rate
- **Definition**: The proportion of attendance shifts that required post-facto supervisor or manager manual correction.
- **Formula**:
  $$\text{Adjustment Rate} = \frac{|\{ s \in \text{Shifts} \mid s.\text{isManuallyAdjusted} = \text{true} \lor s.\text{status} = \text{CORRECTED} \}|}{|\text{Shifts}|} \times 100$$
