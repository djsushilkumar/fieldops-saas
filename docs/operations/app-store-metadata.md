# App Store & Google Play Metadata & Permissions — FieldOps SaaS

| Application | FieldOps Mobile |
| :--- | :--- |
| **Package ID (Android)** | `com.fieldops.app` |
| **Bundle ID (iOS)** | `com.fieldops.mobile` |
| **Target Version** | `1.0.0` (Build 1) |
| **Category** | Business / Productivity |
| **Age Rating** | 4+ (iOS) / Everyone (Google Play) |

---

## 1. Store Listings & Descriptions

### 1.1 App Title & Subtitle
- **App Name**: FieldOps — Field Workforce & Tasks
- **iOS Subtitle (30 chars)**: Tasks, Visits & Proof of Work
- **Google Play Short Description (80 chars)**: Reliable field workforce management, offline visits, GPS check-in & task tracking.

### 1.2 Full Description
```
FieldOps is the modern field operations and task management companion designed for mobile field teams, technicians, inspectors, and trade contractors.

Equip your field workforce to execute scheduled tasks, record on-site visits with point-in-time GPS verification, and capture tamper-evident proof of work—even when operating completely offline.

KEY FEATURES:
• Offline-First Execution: Complete checklists, record notes, and capture customer signatures without internet connectivity. Changes automatically sync once back online.
• Discrete GPS Verification: Verify on-site arrival at customer locations with point-in-time geofence check-ins. No battery-draining continuous fleet tracking.
• Shift & Attendance Tracking: Simple duty clock-in and clock-out with point-in-time presence verification.
• Structured Checklists: Ensure quality and compliance on every job with required checklist items.
• Tamper-Evident Proof of Work: Attach on-site photos, customer sign-offs, and field notes directly to tasks and visits.
• Multi-Tenant Security: Enterprise-grade data protection, session encryption, and role-based access.

FieldOps bridges the gap between office dispatchers and mobile field crews.
```

### 1.3 URLs
- **Privacy Policy URL**: `https://fieldops.com/privacy`
- **Terms of Service URL**: `https://fieldops.com/terms`
- **Support URL**: `https://fieldops.com/support`
- **Marketing URL**: `https://fieldops.com`

---

## 2. App Permissions & Data Safety Disclosures

### 2.1 Fine-Grained Permission Rationale

| Permission | Platform Strings | Purpose & Justification | Continuous Tracking? |
| :--- | :--- | :--- | :---: |
| **Location (Foreground)** | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `NSLocationWhenInUseUsageDescription` | Captured **strictly point-in-time** when the worker clicks "Clock In" or "Check In at Visit" to verify arrival within the customer geofence radius. | **NO**. Zero continuous background tracking or travel breadcrumbs. |
| **Camera** | `CAMERA`, `NSCameraUsageDescription` | Allows field workers to take on-site photos as verifiable proof of work (e.g. completed equipment repair, signed inspection tag). | N/A |
| **Photo Library** | `READ_MEDIA_IMAGES`, `NSPhotoLibraryUsageDescription` | Allows workers to attach existing work order documents or photos. | N/A |
| **Push Notifications** | `POST_NOTIFICATIONS` | Alerts workers when a manager dispatches a new task, reschedules a visit, or updates job instructions. | N/A |

### 2.2 Google Play Data Safety Form Mapping

| Data Type | Collected? | Shared? | Purpose | Ephemeral? |
| :--- | :---: | :---: | :--- | :---: |
| **Approximate / Precise Location** | Yes | No | App functionality (Point-in-time geofence verification) | Yes (Snapshot only) |
| **Name & Email Address** | Yes | No | Account management & authentication | No |
| **Photos & Videos** | Yes | No | App functionality (Proof of work attachments) | No |
| **App Performance & Crash Logs** | Yes | No | Analytics & crash diagnostics (Sentry) | Yes |

### 2.3 Apple Privacy Nutrition Labels

- **Data Used to Track You**: None. FieldOps does not track users across apps and websites owned by other companies.
- **Data Linked to You**:
  - Contact Info (Name, Email)
  - Location (Point-in-time check-in coordinates linked to work order)
  - User Content (Task photos, signatures, checklists)
  - Identifiers (User ID, Device installation ID)
- **Data Not Linked to You**:
  - Diagnostics (Crash logs, performance metrics)
