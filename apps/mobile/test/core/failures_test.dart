import 'package:flutter_test/flutter_test.dart';
import 'package:fieldops_mobile/core/errors/failures.dart';
import 'package:fieldops_mobile/core/errors/error_codes.dart';

void main() {
  group('Mobile Failures and Error Mapping', () {
    test('NetworkFailure defaults to ErrorCodes.networkError', () {
      const failure = NetworkFailure();
      expect(failure.code, equals(ErrorCodes.networkError));
      expect(failure.message, contains('Network connection unavailable'));
    });

    test('AuthFailure maps correctly to ErrorCodes.authenticationError', () {
      const failure = AuthFailure(message: 'Invalid session token');
      expect(failure.code, equals(ErrorCodes.authenticationError));
      expect(failure.message, equals('Invalid session token'));
    });

    test('SyncFailure contains pending count and request ID', () {
      const failure = SyncFailure(
        message: 'Sync interrupted',
        pendingCount: 4,
        requestId: 'req_mobile_123',
      );
      expect(failure.code, equals(ErrorCodes.syncError));
      expect(failure.pendingCount, equals(4));
      expect(failure.requestId, equals('req_mobile_123'));
    });
  });
}
