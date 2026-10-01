import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'secure_storage_contract.dart';

/// Hardware-backed implementation of [SecureStorageContract] using Android Keystore
/// (EncryptedSharedPreferences) and iOS Keychain.
/// Used in production and device release environments.
class EncryptedSecureStorage implements SecureStorageContract {
  final FlutterSecureStorage _storage;

  EncryptedSecureStorage({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock,
              ),
            );

  @override
  Future<void> writeSecret(String key, String value) async {
    await _storage.write(key: key, value: value);
  }

  @override
  Future<String?> readSecret(String key) async {
    return await _storage.read(key: key);
  }

  @override
  Future<void> deleteSecret(String key) async {
    await _storage.delete(key: key);
  }

  @override
  Future<void> clearAllSecrets() async {
    await _storage.deleteAll();
  }
}
