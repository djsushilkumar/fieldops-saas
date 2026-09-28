# ADR-0004: Mobile Application Architecture (Flutter, Riverpod & Drift)

- **Status**: Accepted
- **Date**: 2026-09-28
- **Author**: Lead Mobile Architect

---

## 1. Context

Field workers represent the frontline users of FieldOps. They require a mobile application that performs reliably under harsh environmental conditions: high glare, dusty mechanical rooms, poor battery, and absent cellular coverage. The mobile app must run identically on both Android and iOS devices.

---

## 2. Problem

Which cross-platform mobile technology stack and architecture pattern provides the reliability, offline data performance, and hardware access (Camera, GPS, Keystore) required for FieldOps?

---

## 3. Options Considered

1. **Native iOS (Swift) & Native Android (Kotlin)**:
   - *Pros*: Maximum OS-level fidelity.
   - *Cons*: Double the development and maintenance effort; high risk of business logic and offline sync divergence between platforms.
2. **React Native**:
   - *Pros*: Shared TypeScript skills with web frontend.
   - *Cons*: JavaScript bridge / JSI overhead can cause jank on low-end ruggedized Android devices; complex native camera/background geolocation linking across versions.
3. **Flutter (Dart 3+) with Riverpod & Drift/SQLite**:
   - *Pros*: AOT-compiled native ARM machine code (zero bridge overhead); 60fps consistent UI rendering; robust SQLite integration (Drift); declarative reactive state management (Riverpod); unified code for Android and iOS.

---

## 4. Decision

We will build the mobile application with **Flutter 3.24+ / Dart 3.5+**:
- **State Management**: **Riverpod 2.x** for declarative, decoupled, and testable application state.
- **Routing**: **GoRouter** for URL-based deep linking and declarative route protection.
- **Local Persistence**: Embedded **SQLite / Drift** for offline-first data transactions and mutation queues.
- **Secure Storage**: **flutter_secure_storage** for hardware keystore/keychain encryption.

---

## 5. Consequences

- **Positive**: 100% single-codebase parity between Android and iOS; outstanding rendering performance and camera responsiveness; robust offline ACID storage.
- **Negative**: Dart language requires separate package tooling from the TypeScript monorepo packages (mitigated by generating Dart design tokens and mirroring API contracts).
