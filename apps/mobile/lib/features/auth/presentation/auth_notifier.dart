import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/storage/in_memory_secure_storage.dart';
import '../../../core/storage/secure_storage_contract.dart';
import '../data/auth_repository.dart';
import '../domain/auth_models.dart';

class AuthStatusState {
  final AuthState authState;
  final UserProfile? user;
  final Membership? activeMembership;
  final List<Membership> memberships;
  final String? errorMessage;

  const AuthStatusState({
    required this.authState,
    this.user,
    this.activeMembership,
    this.memberships = const [],
    this.errorMessage,
  });

  factory AuthStatusState.initial() => const AuthStatusState(
        authState: AuthState.unknown,
      );

  AuthStatusState copyWith({
    AuthState? authState,
    UserProfile? user,
    Membership? activeMembership,
    List<Membership>? memberships,
    String? errorMessage,
    bool clearError = false,
  }) {
    return AuthStatusState(
      authState: authState ?? this.authState,
      user: user ?? this.user,
      activeMembership: activeMembership ?? this.activeMembership,
      memberships: memberships ?? this.memberships,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

final secureStorageProvider = Provider<SecureStorageContract>((ref) {
  return InMemorySecureStorage();
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final secureStorage = ref.watch(secureStorageProvider);
  return AuthRepository(secureStorage: secureStorage);
});

class AuthNotifier extends StateNotifier<AuthStatusState> {
  final AuthRepository _repository;

  AuthNotifier(this._repository) : super(AuthStatusState.initial());

  Future<void> restoreSession() async {
    state = state.copyWith(authState: AuthState.authenticating, clearError: true);
    try {
      final session = await _repository.restoreSession();
      if (session != null) {
        state = AuthStatusState(
          authState: AuthState.authenticated,
          user: session.user,
          activeMembership: session.activeMembership,
          memberships: session.memberships,
        );
      } else {
        state = const AuthStatusState(authState: AuthState.unauthenticated);
      }
    } catch (e) {
      state = AuthStatusState(
        authState: AuthState.authError,
        errorMessage: e.toString(),
      );
    }
  }

  Future<void> signIn({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(authState: AuthState.authenticating, clearError: true);
    try {
      final session = await _repository.signIn(email: email, password: password);
      state = AuthStatusState(
        authState: AuthState.authenticated,
        user: session.user,
        activeMembership: session.activeMembership,
        memberships: session.memberships,
      );
    } catch (e) {
      state = AuthStatusState(
        authState: AuthState.authError,
        errorMessage: e.toString(),
      );
      rethrow;
    }
  }

  Future<void> signInWithDemo() async {
    state = state.copyWith(authState: AuthState.authenticating, clearError: true);
    const demoOrg = Organization(
      id: 'org_fieldops_demo',
      name: 'FieldOps Demonstration Team',
      slug: 'fieldops-demo',
      subscriptionTier: 'GROWTH',
    );
    const demoMembership = Membership(
      id: 'mem_demo_01',
      organizationId: 'org_fieldops_demo',
      userId: 'usr_demo_fieldworker',
      role: 'FIELD_WORKER',
      status: 'ACTIVE',
      organization: demoOrg,
    );
    const demoUser = UserProfile(
      id: 'usr_demo_fieldworker',
      email: 'worker@fieldops.io',
      fullName: 'Demo Field Worker',
      timezone: 'UTC',
    );

    state = const AuthStatusState(
      authState: AuthState.authenticated,
      user: demoUser,
      activeMembership: demoMembership,
      memberships: [demoMembership],
    );
  }

  Future<void> switchOrganization(String organizationId) async {
    final match = state.memberships.firstWhere(
      (m) => m.organizationId == organizationId,
      orElse: () => throw Exception('Membership not found in organization $organizationId'),
    );

    await _repository.switchOrganization(organizationId);
    state = state.copyWith(activeMembership: match);
  }

  Future<void> signOut() async {
    try {
      await _repository.signOut();
    } finally {
      state = const AuthStatusState(authState: AuthState.unauthenticated);
    }
  }
}

final authNotifierProvider =
    StateNotifierProvider<AuthNotifier, AuthStatusState>((ref) {
  final repository = ref.watch(authRepositoryProvider);
  return AuthNotifier(repository);
});
