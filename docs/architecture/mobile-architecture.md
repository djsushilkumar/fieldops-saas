# FieldOps — Mobile Application Architecture Specification

---

## 1. Mobile Technology Foundation

FieldOps Mobile is engineered using **Flutter 3.24+ / Dart 3.5+** targeting Android 10+ and iOS 16+. Flutter provides a single, high-performance native codebase that delivers 60fps rendering, hardware-accelerated camera access, and offline data processing.

---

## 2. Layered Architecture Pattern

```
lib/
├── core/                       # Cross-cutting platform infrastructure
│   ├── config/                 # Environment variables and API endpoints
│   ├── errors/                 # Domain failures and error code mappings
│   ├── networking/             # HTTP client, request ID interceptor, retry logic
│   ├── storage/                # SQLite / Drift database and secure storage contracts
│   ├── connectivity/           # Network reachability streams and observers
│   ├── logging/                # Structured logger with secret redaction
│   ├── routing/                # GoRouter declarative navigation tree
│   └── theme/                  # Material 3 theme consuming FieldOps tokens
│
├── features/                   # Encapsulated operational feature modules
│   ├── auth/                   # Session, credentials, tenant selection
│   ├── tasks/                  # Task list, detail, checklist execution
│   ├── visits/                 # Visit schedule, navigation deep links, check-in
│   ├── attendance/             # Shift clock-in/out, duty stopwatch
│   └── sync/                   # Background mutation queue and conflict engine
│
└── shared/                     # Reusable widgets and UI primitives
    └── widgets/                # Buttons, badges, input fields
```

---

## 3. Core Architectural Choices

### 3.1. State Management with Riverpod
- State is managed declaratively using **Riverpod 2.x**.
- Providers decouple business logic from UI widgets, enabling comprehensive unit testing without mocking the widget tree.
- Dependency injection occurs via `ref.watch()` and `ref.read()`.

### 3.2. Declarative Routing with GoRouter
- Navigation is controlled via **GoRouter**.
- Deep links (e.g. `fieldops://tasks/018f2e23-...`) map cleanly to task detail screens.
- Navigation guards prevent unauthenticated users from accessing operational routes.

### 3.3. Offline Local Persistence
- Local data is managed by an embedded SQLite engine (via **Drift / sqflite**).
- Writes execute locally first inside atomic ACID transactions, simultaneously appending a record to the persistent mutation sync queue.

---

## 4. Mobile Device Security Baseline

1. **Hardware Keystore Protection**: Auth tokens, refresh secrets, and tenant cryptographic keys are encrypted using Android Keystore / iOS Keychain via `flutter_secure_storage`.
2. **App Background Privacy**: When the app is backgrounded or shown in the OS task switcher, sensitive screens (e.g. customer addresses, client signatures) are masked with a privacy shield overlay.
3. **Graceful Permission Handling**: Location, camera, and notification permissions are requested with pre-permission educational cards explaining operational necessity.

---

## 5. Map Provider Abstraction (`MapService`)

To prevent hard-coding the application to a single map SDK, FieldOps defines a decoupled **`MapService`** interface:

```dart
abstract class MapService {
  /// Opens native turn-by-turn navigation (Google Maps, Apple Maps, or Waze).
  Future<void> launchNavigation({
    required double latitude,
    required double longitude,
    required String addressTitle,
  });

  /// Computes geodesic distance in meters using the Haversine formula.
  double calculateDistanceMeters({
    required double startLat,
    required double startLon,
    required double targetLat,
    required double targetLon,
  });
}
```
