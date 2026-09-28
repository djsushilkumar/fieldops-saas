# FieldOps — Mobile Authentication Implementation Guide

---

## 1. Flutter 3.24+ State Management & Keystore Integration

The mobile application under `apps/mobile` enforces hardware-backed credential persistence, offline session survivability, and declarative navigation guards.

---

## 2. Secure Storage Contract (`SecureStorageContract`)

Credentials and session tokens are never stored in SharedPreferences or unencrypted SQLite tables. They are passed through the hardware-backed keystore abstraction:

```dart
abstract class SecureStorageContract {
  Future<void> writeSecret(String key, String value);
  Future<String?> readSecret(String key);
  Future<void> deleteSecret(String key);
  Future<void> clearAllSecrets();
}
```

Implementation notes:
- **Android**: Wrapped by Android Keystore with AES-GCM encryption.
- **iOS**: Wrapped by iOS Keychain with `kSecAttrAccessibleAfterFirstUnlock`.
- **Test / Headless**: Implemented via `InMemorySecureStorage` for reproducible test suites.

---

## 3. Riverpod Auth Notifier (`AuthNotifier`)

`AuthNotifier` manages the 6-state lifecycle:

- `restoreSession()`: Attempts to read `auth_access_token` and `auth_active_tenant_id` on app launch. If valid, transitions to `authenticated`; otherwise, `unauthenticated`.
- `signIn({ email, password })`: Authenticates via API, writes tokens to hardware keystore, and sets active membership.
- `switchOrganization(orgId)`: Updates active tenant in state and writes `auth_active_tenant_id` to keystore.
- `signOut()`: Issues server-side logout, calls `clearAllSecrets()`, and resets state to `unauthenticated`.
