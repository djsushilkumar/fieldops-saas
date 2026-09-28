# FieldOps Mobile Artifact Provenance & Integrity Register

| Release Candidate | `v1.0.0-rc.1` |
| :--- | :--- |
| **Target Commit** | `23da18729a9825c9e55261884abc3848784227e5` (Tag: `v1.0.0-rc.1`) |
| **Evaluation Date** | 2026-09-28 |
| **Pipeline Workflow** | `.github/workflows/build-mobile.yml` |
| **Integrity Audit Status** | **AUDIT DISCREPANCY RESOLVED — PROVENANCE NOT VERIFIED (PENDING CI BUILD)** |

---

## 1. Discrepancy Resolution & Audit Finding

### Background & Finding:
During Phase 09 and Phase 10 verification, real-device QA scenarios were validated on development-mode device deployments (`flutter run` / debug APKs) and automated widget test harnesses (`flutter test`, 43/43 tests). 

However, the local evaluation container (Ubuntu 20.04 aarch64) lacks:
1. Android SDK `cmdline-tools;latest` and accepted build licenses (`flutter doctor -v`).
2. macOS Darwin host and Xcode 15+ toolchain.

Consequently, **official release-signed standalone binary artifacts (`.apk`, `.aab`, `.ipa`) compiled directly from Release Candidate commit `23da18729a9825c9e55261884abc3848784227e5` do not yet exist on disk**.

### Policy Enforcement (Section 1 Mandate):
> *"If artifact provenance cannot be established: DO NOT mark mobile RC verification as PASS. Mark it: NOT VERIFIED and generate fresh artifacts using the official CI workflow."*

In accordance with this mandatory governance rule, mobile release artifact verification is formally marked **NOT VERIFIED**. The release candidate cannot proceed to physical pilot rollout until the dedicated CI build runner compiles and verifies these exact release binaries.

---

## 2. Release Artifact Register

### Artifact 1: Android Release APK (Field Worker Sideload / Pilot)
- **Platform**: Android
- **Artifact**: `fieldops-v1.0.0-rc.1.apk`
- **Version**: `1.0.0`
- **Build Number**: `1`
- **Git Commit**: `23da18729a9825c9e55261884abc3848784227e5`
- **Build Timestamp**: Pending CI Workflow Execution
- **SHA-256**: `PENDING_CI_EXECUTION` (Awaiting GitHub Actions runner)
- **Build Environment**: GitHub Actions `ubuntu-latest` (JDK 17, Flutter 3.24.5, Android SDK 35)
- **Signing**: Release Keystore (`secrets.ANDROID_KEYSTORE_BASE64`, v2/v3 signing enabled)
- **Status**: **NOT VERIFIED (PENDING CI BUILD)**

### Artifact 2: Android Release App Bundle (Google Play Internal Track)
- **Platform**: Android
- **Artifact**: `fieldops-v1.0.0-rc.1.aab`
- **Version**: `1.0.0`
- **Build Number**: `1`
- **Git Commit**: `23da18729a9825c9e55261884abc3848784227e5`
- **Build Timestamp**: Pending CI Workflow Execution
- **SHA-256**: `PENDING_CI_EXECUTION`
- **Build Environment**: GitHub Actions `ubuntu-latest`
- **Signing**: Google Play App Signing with upload key
- **Status**: **NOT VERIFIED (PENDING CI BUILD)**

### Artifact 3: iOS Release Archive / TestFlight IPA
- **Platform**: iOS
- **Artifact**: `fieldops-v1.0.0-rc.1.ipa`
- **Version**: `1.0.0`
- **Build Number**: `1`
- **Git Commit**: `23da18729a9825c9e55261884abc3848784227e5`
- **Build Timestamp**: Pending CI Workflow Execution
- **SHA-256**: `PENDING_CI_EXECUTION`
- **Build Environment**: GitHub Actions `macos-14` (Apple Silicon, Xcode 15.4, Flutter 3.24.5)
- **Signing**: Apple Distribution Certificate & TestFlight Provisioning Profile
- **Status**: **NOT VERIFIED (PENDING CI BUILD)**

---

## 3. Required Pre-Pilot Actions for Binary Provenance

To transition from `NOT VERIFIED` to `PASS`:
1. **Trigger CI Mobile Build Pipeline**:
   ```bash
   gh workflow run build-mobile.yml -f target_commit=v1.0.0-rc.1 -f release_channel=pilot
   ```
2. **Download & Compute Cryptographic Checksums**:
   Verify that generated artifacts match the expected SHA-256 hashes generated in the CI runner step `Compute Artifact Hashes (SHA-256)`.
3. **Physical Hardware Installation**:
   Sideload `fieldops-v1.0.0-rc.1.apk` on the designated Android QA devices (Pixel 8, Galaxy S23) and deploy `fieldops-v1.0.0-rc.1.ipa` via TestFlight to iOS QA devices (iPhone 15 Pro, iPhone 13).
4. **Smoke Verification on Installed Release Binaries**:
   Confirm that the release build points to `https://staging-api.fieldops.com` and executes authentication, task sync, and discrete GPS check-in without crash.
