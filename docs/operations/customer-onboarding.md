# Customer Onboarding & First-Run Guide — FieldOps SaaS

| Document Version | 1.0.0 |
| :--- | :--- |
| **Phase** | **Phase 10 — Production Launch & Operations** |
| **Target Audience** | New Organization Owners, Administrators & Dispatchers |
| **Objective** | Zero-friction path from signup to first verified field job in $< 15\text{ minutes}$ |

---

## 1. The Core 8-Step Onboarding Sequence

```
[1. Create Organization] ──► [2. Invite Team Members] ──► [3. Organize Crews & Teams]
                                                                    │
                                                                    ▼
[6. Worker Installs App] ◄── [5. Dispatch First Visit] ◄── [4. Add Geofenced Location]
         │
         ▼
[7. Point-in-Time GPS Verification] ──► [8. Verify Proof of Work in Web Console]
```

---

## 2. Detailed Step-by-Step Instructions

### Step 1: Create Organization & Workspace
- Navigate to `https://app.fieldops.com/org/create`.
- Enter Organization Legal Name (e.g., "Apex Refrigeration Services") and preferred URL workspace identifier.
- The creator is automatically designated as the initial organization **OWNER**.

### Step 2: Invite Organization Members & Assign Roles
- Navigate to **Settings $\to$ Members & Invitations** (`/organization/members`).
- Click **Invite Member** and specify:
  - **Email Address**: `technician@apexhvac.com`
  - **Assigned Role**:
    - `ADMIN`: Full administrative control, team and member management.
    - `MANAGER`: Task assignment, operational dispatch, exception review.
    - `DISPATCHER`: Daily calendar scheduling and route dispatch.
    - `FIELD_WORKER`: Mobile field execution, task checklists, GPS check-in.
- The invitee receives a secure single-use invitation link expiring in 72 hours.

### Step 3: Establish Operational Teams
- Navigate to **Teams** (`/teams`).
- Create functional squads (e.g., "North Metro HVAC Maintenance", "Emergency Electrical").
- Assign a Team Lead and member roster for grouped dispatching.

### Step 4: Add Geofenced Customer Locations
- Navigate to **Locations** (`/locations`).
- Click **New Location** and enter:
  - **Location Name**: "Downtown Medical Pavilion"
  - **Street Address**: "100 Hospital Way, Building B"
  - **Coordinates**: Latitude `37.7749`, Longitude `-122.4194`.
  - **Allowed Geofence Radius**: Select `50m`, `100m` (default), or custom up to `500m`.

### Step 5: Create First Structured Task & Field Visit
- Navigate to **Tasks** (`/tasks`) $\to$ **New Task**.
- Enter title: "Quarterly HVAC Filter Replacement & Coil Inspection".
- Add checklist items:
  - [ ] Replace primary HEPA filter.
  - [ ] Inspect condensation drain pan.
  - [ ] Measure refrigerant pressure.
  - [ ] Capture photo of completed service tag.
  - [ ] Obtain customer sign-off signature.
- Click **Schedule Visit** to attach location, appointment time, and assign the target Field Worker.

### Step 6: Field Worker Installs Mobile Application
- Field worker downloads the **FieldOps Mobile** app from Google Play or Apple App Store.
- Worker logs in with their authenticated credentials.
- The mobile app performs an initial sync, caching today's assigned tasks and locations in the local encrypted SQLite database.

### Step 7: Worker Executes First Field Workflow
1. **Clock-In**: Worker clicks **Start Shift**; the app captures point-in-time presence.
2. **Arrive at Site**: Worker taps **Check-In** at the scheduled visit. The mobile app compares current GPS coordinates to the location geofence via Haversine calculation.
3. **Execute Work**: Worker checks off items, snaps an on-site photo, and captures the client's signature.
4. **Complete Visit**: Worker taps **Complete Visit**. If offline, the mutation is queued locally and syncs automatically upon network reconnection.

### Step 8: Manager Reviews in Operations Dashboard
- The Dispatcher/Manager opens the Web Operations Dashboard (`/dashboard`).
- View the completed visit pin on the live operational map.
- Inspect the attached photo, signature proof, and geofence verification badge.
- Download the executive summary via **Reports $\to$ RFC 4180 CSV Export**.
