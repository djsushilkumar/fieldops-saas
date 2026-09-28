import 'secure_storage_contract.dart';

/// In-memory implementation of [SecureStorageContract] suitable for testing,
/// development, and environments without platform keystore channels.
class InMemorySecureStorage implements SecureStorageContract {
  final Map<String, String> _storage = {};

  @override
  Future<void> writeSecret(String key, String value) async {
    _storage[key] = value;
  }

  @override
  Future<String?> readSecret(String key) async {
    return _storage[key];
  }

  @override
  Future<void> deleteSecret(String key) async {
    _storage.remove(key);
  }

  @override
  Future<void> clearAllSecrets() async {
    _storage.clear();
  }
}
