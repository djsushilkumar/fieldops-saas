import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../core/storage/secure_storage_contract.dart';
import '../../../core/errors/failures.dart';
import '../domain/auth_models.dart';

class AuthRepository {
  final SecureStorageContract _secureStorage;
  final String _baseUrl;
  final http.Client _httpClient;

  static const String keyAccessToken = 'auth_access_token';
  static const String keyRefreshToken = 'auth_refresh_token';
  static const String keyActiveTenantId = 'auth_active_tenant_id';

  AuthRepository({
    required SecureStorageContract secureStorage,
    String baseUrl = 'http://127.0.0.1:54321',
    http.Client? httpClient,
  })  : _secureStorage = secureStorage,
        _baseUrl = baseUrl,
        _httpClient = httpClient ?? http.Client();

  /// Authenticates using email and password, persisting tokens securely.
  Future<AuthSession> signIn({
    required String email,
    required String password,
  }) async {
    final trimmedEmail = email.trim();
    if (trimmedEmail.isEmpty || password.isEmpty) {
      throw const AuthFailure(message: 'Email and password are required.');
    }

    try {
      final url = Uri.parse('$_baseUrl/api/v1/auth/login');
      final response = await _httpClient.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': trimmedEmail,
          'password': password,
        }),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(response.body) as Map<String, dynamic>;
        final data = decoded['data'] as Map<String, dynamic>? ?? decoded;
        final session = AuthSession.fromJson(data);

        await _persistSession(session);
        return session;
      } else {
        String errorMsg = 'Invalid credentials or authentication failure.';
        try {
          final decoded = jsonDecode(response.body) as Map<String, dynamic>;
          if (decoded['error'] is Map) {
            errorMsg = (decoded['error'] as Map)['message'] as String? ?? errorMsg;
          }
        } catch (_) {}
        throw AuthFailure(message: errorMsg);
      }
    } on AuthFailure {
      rethrow;
    } catch (e) {
      throw AuthFailure(message: 'Authentication network failure: $e');
    }
  }

  /// Restores session from hardware-backed secure storage.
  Future<AuthSession?> restoreSession() async {
    final token = await _secureStorage.readSecret(keyAccessToken);
    if (token == null || token.isEmpty) {
      return null;
    }

    try {
      final url = Uri.parse('$_baseUrl/api/v1/auth/session');
      final tenantId = await _secureStorage.readSecret(keyActiveTenantId);

      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (tenantId != null) 'x-tenant-id': tenantId,
      };

      final response = await _httpClient.get(url, headers: headers);
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body) as Map<String, dynamic>;
        final data = decoded['data'] as Map<String, dynamic>? ?? decoded;
        return AuthSession.fromJson(data);
      } else if (response.statusCode == 401) {
        await signOut();
        return null;
      }
    } catch (_) {
      // In offline conditions, allow graceful degradation if token is cached
      return null;
    }

    return null;
  }

  /// Switches active tenant context and records it to secure storage.
  Future<void> switchOrganization(String organizationId) async {
    await _secureStorage.writeSecret(keyActiveTenantId, organizationId);
  }

  /// Signs out and purges all hardware keystore credentials.
  Future<void> signOut() async {
    try {
      final token = await _secureStorage.readSecret(keyAccessToken);
      if (token != null) {
        final url = Uri.parse('$_baseUrl/api/v1/auth/logout');
        await _httpClient.post(
          url,
          headers: {'Authorization': 'Bearer $token'},
        ).catchError((_) => http.Response('', 500));
      }
    } finally {
      await _secureStorage.deleteSecret(keyAccessToken);
      await _secureStorage.deleteSecret(keyRefreshToken);
      await _secureStorage.deleteSecret(keyActiveTenantId);
    }
  }

  Future<void> _persistSession(AuthSession session) async {
    await _secureStorage.writeSecret(keyAccessToken, session.tokens.accessToken);
    if (session.tokens.refreshToken != null) {
      await _secureStorage.writeSecret(keyRefreshToken, session.tokens.refreshToken!);
    }
    if (session.activeMembership != null) {
      await _secureStorage.writeSecret(
        keyActiveTenantId,
        session.activeMembership!.organizationId,
      );
    }
  }
}
