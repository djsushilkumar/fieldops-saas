/// Contract for securely storing sensitive credentials (tokens, refresh keys)
/// using hardware-backed keystore (Android Keystore / iOS Keychain).
abstract class SecureStorageContract {
  Future<void> writeSecret(String key, String value);
  Future<String?> readSecret(String key);
  Future<void> deleteSecret(String key);
  Future<void> clearAllSecrets();
}
