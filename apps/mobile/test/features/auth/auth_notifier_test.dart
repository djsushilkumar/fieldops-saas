import 'package:flutter_test/flutter_test.dart';
import 'package:fieldops_mobile/core/storage/in_memory_secure_storage.dart';
import 'package:fieldops_mobile/features/auth/data/auth_repository.dart';
import 'package:fieldops_mobile/features/auth/domain/auth_models.dart';
import 'package:fieldops_mobile/features/auth/presentation/auth_notifier.dart';

void main() {
  group('AuthNotifier State Machine', () {
    late InMemorySecureStorage secureStorage;
    late AuthRepository repository;
    late AuthNotifier notifier;

    setUp(() {
      secureStorage = InMemorySecureStorage();
      repository = AuthRepository(secureStorage: secureStorage);
      notifier = AuthNotifier(repository);
    });

    test('initial state is unknown', () {
      expect(notifier.state.authState, AuthState.unknown);
      expect(notifier.state.user, isNull);
      expect(notifier.state.activeMembership, isNull);
    });

    test('restoreSession transitions to unauthenticated when storage is empty', () async {
      await notifier.restoreSession();
      expect(notifier.state.authState, AuthState.unauthenticated);
      expect(notifier.state.user, isNull);
    });

    test('signOut clears stored credentials and sets unauthenticated state', () async {
      await secureStorage.writeSecret(AuthRepository.keyAccessToken, 'some_token');
      await secureStorage.writeSecret(AuthRepository.keyActiveTenantId, 'tenant_1');

      await notifier.signOut();

      expect(notifier.state.authState, AuthState.unauthenticated);
      expect(await secureStorage.readSecret(AuthRepository.keyAccessToken), isNull);
      expect(await secureStorage.readSecret(AuthRepository.keyActiveTenantId), isNull);
    });

    test('switchOrganization updates activeMembership within state', () async {
      const mem1 = Membership(
        id: 'mem_1',
        organizationId: 'org_1',
        userId: 'user_1',
        role: 'FIELD_WORKER',
        status: 'ACTIVE',
      );
      const mem2 = Membership(
        id: 'mem_2',
        organizationId: 'org_2',
        userId: 'user_1',
        role: 'SUPERVISOR',
        status: 'ACTIVE',
      );

      // Pre-seed state with memberships
      notifier.state = const AuthStatusState(
        authState: AuthState.authenticated,
        activeMembership: mem1,
        memberships: [mem1, mem2],
      );

      await notifier.switchOrganization('org_2');

      expect(notifier.state.activeMembership?.organizationId, 'org_2');
      expect(notifier.state.activeMembership?.role, 'SUPERVISOR');
      expect(await secureStorage.readSecret(AuthRepository.keyActiveTenantId), 'org_2');
    });
  });
}
