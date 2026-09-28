# FieldOps Real-Device Release Candidate Smoke Matrix

| Release Candidate | `v1.0.0-rc.1` |
| :--- | :--- |
| **Commit Target** | `23da18729a9825c9e55261884abc3848784227e5` |
| **Verification Date** | 2026-09-28 |
| **Integrity Governance** | Exact signed binaries required; no debug builds or simulated hashes permitted |
| **Evaluation Status** | **BLOCKED (Awaiting CI-Compiled Release Artifacts)** |

---

## 1. Governance & Verification Protocol

In strict accordance with FieldOps Engineering Rules and Section 14 of the Mobile RC Verification Specification:
> *"The only thing that matters now is proving: 'The exact signed mobile binaries built from v1.0.0-rc.1 are the binaries that pass final device smoke testing.' Do not substitute debug builds. Do not substitute another commit. Do not fabricate artifact hashes. Do not bypass the gate."*

Because the execution environment lacks GitHub CLI authentication (`gh: command not found`) and remote CI build agents have not yet returned standalone signed `.apk`, `.aab`, and `.ipa` artifacts, device-level test results are held in **BLOCKED** status awaiting physical sideload and TestFlight installation of the exact SHA-256 binary outputs.

---

## 2. Hardware Device Smoke Register

### Device 1: Google Pixel 8 (Primary Android Flagship)
- **Device**: Google Pixel 8
- **OS**: Android 14 (API 34)
- **App Version**: `1.0.0`
- **Build**: `1`
- **Artifact SHA-256**: `PENDING_CI_EXECUTION`
- **Install Method**: Sideload (`adb install -r fieldops-v1.0.0-rc.1.apk`)
- **Test Date**: Scheduled upon CI artifact retrieval
- **Authentication**: GATED (Pending Release APK)
- **Tasks**: GATED
- **Visits**: GATED
- **GPS**: GATED
- **Attendance**: GATED
- **Offline**: GATED
- **Proof**: GATED
- **Notifications**: GATED
- **Logout**: GATED
- **Result**: **BLOCKED**
- **Notes**: Automated Flutter widget & unit test suite passed 43/43 tests, but runtime execution on the standalone signed release binary requires CI artifact generation.

### Device 2: Samsung Galaxy S23 (Secondary Android Tier-1)
- **Device**: Samsung Galaxy S23
- **OS**: Android 14 (One UI 6.1)
- **App Version**: `1.0.0`
- **Build**: `1`
- **Artifact SHA-256**: `PENDING_CI_EXECUTION`
- **Install Method**: Sideload (`adb install -r fieldops-v1.0.0-rc.1.apk`)
- **Test Date**: Scheduled upon CI artifact retrieval
- **Authentication**: GATED
- **Tasks**: GATED
- **Visits**: GATED
- **GPS**: GATED
- **Attendance**: GATED
- **Offline**: GATED
- **Proof**: GATED
- **Notifications**: GATED
- **Logout**: GATED
- **Result**: **BLOCKED**
- **Notes**: Awaiting CI output.

### Device 3: Motorola Moto G Power (Android Budget Tier)
- **Device**: Motorola Moto G Power
- **OS**: Android 13 (API 33)
- **App Version**: `1.0.0`
- **Build**: `1`
- **Artifact SHA-256**: `PENDING_CI_EXECUTION`
- **Install Method**: Sideload (`adb install -r fieldops-v1.0.0-rc.1.apk`)
- **Test Date**: Scheduled upon CI artifact retrieval
- **Authentication**: GATED
- **Tasks**: GATED
- **Visits**: GATED
- **GPS**: GATED
- **Attendance**: GATED
- **Offline**: GATED
- **Proof**: GATED
- **Notifications**: GATED
- **Logout**: GATED
- **Result**: **BLOCKED**
- **Notes**: Awaiting CI output.

### Device 4: Apple iPhone 15 Pro (Primary iOS Flagship)
- **Device**: Apple iPhone 15 Pro
- **OS**: iOS 17.5
- **App Version**: `1.0.0`
- **Build**: `1`
- **Artifact SHA-256**: `PENDING_CI_EXECUTION`
- **Install Method**: Apple TestFlight (Internal Pilot Track)
- **Test Date**: Scheduled upon CI artifact retrieval
- **Authentication**: GATED (Pending TestFlight IPA)
- **Tasks**: GATED
- **Visits**: GATED
- **GPS**: GATED
- **Attendance**: GATED
- **Offline**: GATED
- **Proof**: GATED
- **Notifications**: GATED
- **Logout**: GATED
- **Result**: **BLOCKED**
- **Notes**: Requires macOS GitHub Actions runner (`build-ios` job) with Apple distribution signing certificate.

### Device 5: Apple iPhone 13 (Secondary iOS Tier-1)
- **Device**: Apple iPhone 13
- **OS**: iOS 16.7
- **App Version**: `1.0.0`
- **Build**: `1`
- **Artifact SHA-256**: `PENDING_CI_EXECUTION`
- **Install Method**: Apple TestFlight
- **Test Date**: Scheduled upon CI artifact retrieval
- **Authentication**: GATED
- **Tasks**: GATED
- **Visits**: GATED
- **GPS**: GATED
- **Attendance**: GATED
- **Offline**: GATED
- **Proof**: GATED
- **Notifications**: GATED
- **Logout**: GATED
- **Result**: **BLOCKED**
- **Notes**: Awaiting TestFlight build.

### Device 6: Apple iPhone SE 3rd Gen (iOS Compact Tier)
- **Device**: Apple iPhone SE (3rd Gen)
- **OS**: iOS 17.4
- **App Version**: `1.0.0`
- **Build**: `1`
- **Artifact SHA-256**: `PENDING_CI_EXECUTION`
- **Install Method**: Apple TestFlight
- **Test Date**: Scheduled upon CI artifact retrieval
- **Authentication**: GATED
- **Tasks**: GATED
- **Visits**: GATED
- **GPS**: GATED
- **Attendance**: GATED
- **Offline**: GATED
- **Proof**: GATED
- **Notifications**: GATED
- **Logout**: GATED
- **Result**: **BLOCKED**
- **Notes**: Awaiting TestFlight build.

---

## 3. Hardware Test Execution Plan

Upon CI generation of the signed binaries:
1. Verify SHA-256 against CI build logs.
2. Install APK on Pixel 8 / Galaxy S23; accept TestFlight invite on iPhone 15 Pro.
3. Execute the 12-point smoke protocol:
   - Login -> Verify JWT storage in hardware Keystore / Secure Enclave
   - View tasks -> Transition `ASSIGNED` -> `ACCEPTED` -> `IN_PROGRESS`
   - Open visit -> Point-in-time discrete GPS acquisition -> Verify within 100m geofence -> Check-in
   - Capture photo proof -> Verify downscaling to 1080p (<2MB) -> Upload to `fieldops-media`
   - Complete visit checklist -> Capture customer signature -> Check-out
   - Toggle Airplane Mode -> Perform offline visit notes and status update -> Force kill app -> Cold restart -> Disable Airplane Mode -> Verify automatic idempotent sync
   - Receive high-priority push notification -> Tap deep link -> Confirm navigation to target visit
   - Execute "Logout & Wipe Cache" -> Confirm local SQLite database dropped and media cache cleared.
4. Record exact verification timestamps and operator signatures.
