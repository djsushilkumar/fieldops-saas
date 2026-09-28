import 'package:flutter_test/flutter_test.dart';
import 'package:fieldops_mobile/core/storage/in_memory_secure_storage.dart';

void main() {
  group('InMemorySecureStorage', () {
    late InMemorySecureStorage storage;

    setUp(() {
      storage = InMemorySecureStorage();
    });

    test('writes and reads secret key-value pairs', () async {
      await storage.writeSecret('jwt_token', 'secret_abc_123');
      final retrieved = await storage.readSecret('jwt_token');
      expect(retrieved, 'secret_abc_123');
    });

    test('returns null for non-existent secret keys', () async {
      final retrieved = await storage.readSecret('missing_key');
      expect(retrieved, isNull);
    });

    test('deletes specified secret keys', () async {
      await storage.writeSecret('key_to_delete', 'value');
      await storage.deleteSecret('key_to_delete');
      final retrieved = await storage.readSecret('key_to_delete');
      expect(retrieved, isNull);
    });

    test('clearAllSecrets purges entire keystore', () async {
      await storage.writeSecret('token1', 'val1');
      await storage.writeSecret('token2', 'val2');

      await storage.clearAllSecrets();

      expect(await storage.readSecret('token1'), isNull);
      expect(await storage.readSecret('token2'), isNull);
    });
  });
}
