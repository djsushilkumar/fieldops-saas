# Location Privacy & Data Minimization Policy

## 1. Principles & Purpose

FieldOps is designed to help organizations manage operational execution while maintaining field worker privacy and trust. The platform adheres to the principles of **Data Minimization**, **Purpose Limitation**, and **Operational Transparency**.

---

## 2. Privacy Guardrails

```
             ┌────────────────────────────────────────────────────────┐
             │            WHAT FIELDOPS CAPTURES                      │
             ├────────────────────────────────────────────────────────┤
             │  ✔ Point-in-time check-in coordinates                  │
             │  ✔ Point-in-time check-out coordinates                 │
             │  ✔ Geofence distance calculation at arrival            │
             │  ✔ Photo proof location metadata                       │
             │  ✔ Departure timestamp for labor duration              │
             └────────────────────────────────────────────────────────┘
                                         ▼
             ┌────────────────────────────────────────────────────────┐
             │            WHAT FIELDOPS NEVER CAPTURES                │
             ├────────────────────────────────────────────────────────┤
             │  ✖ Continuous background GPS / breadcrumbing           │
             │  ✖ Real-time driving speed or road route telemetry     │
             │  ✖ Off-shift or break-time location monitoring         │
             │  ✖ Wi-Fi SSID / Bluetooth device beacon sniffing       │
             │  ✖ Personal browsing or ambient microphone audio       │
             └────────────────────────────────────────────────────────┘
```

### 2.1 Point-in-Time Event Capture
Coordinates are accessed ONLY when a technician initiates an operational action in the application:
1. Tap on "Check In"
2. Tap on "Check Out"
3. Capture of a Photo or Signature Proof

### 2.2 No Persistent Background Tracking
The mobile application does not run a continuous background location service. When the technician is driving, eating lunch, or off-duty, the application ceases all location access.

### 2.3 Worker Visibility
Whenever the application accesses device location, clear UI indicators inform the technician:
- Proximity banner showing distance to target destination.
- Verification badge indicating whether coordinates fall within the authorized radius.

---

## 3. Regulatory Compliance

1. **GDPR Article 5(1)(c) (Data Minimization)**: FieldOps stores only the geographic coordinates strictly necessary to verify arrival at customer premises.
2. **Labor Privacy Standards**: Point-in-time arrival/departure verification is legally permissible for shift verification without infringing on employee rights associated with persistent surveillance.
3. **Data Retention & Purging**: Raw `location_events` rows are retained according to the organization's configured audit policy (e.g. 90 or 365 days) and can be purged upon request.
