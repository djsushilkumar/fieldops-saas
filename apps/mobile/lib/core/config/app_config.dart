/// Environment configuration for the FieldOps mobile client.
class AppConfig {
  final String appEnv;
  final String apiUrl;
  final String supabaseUrl;
  final String supabaseAnonKey;
  final Duration connectTimeout;
  final Duration receiveTimeout;

  const AppConfig({
    required this.appEnv,
    required this.apiUrl,
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    this.connectTimeout = const Duration(seconds: 10),
    this.receiveTimeout = const Duration(seconds: 15),
  });

  /// Default local development configuration.
  factory AppConfig.development() {
    return const AppConfig(
      appEnv: 'development',
      apiUrl: 'http://10.0.2.2:3000/api/v1',
      supabaseUrl: 'http://10.0.2.2:54321',
      supabaseAnonKey: 'placeholder-anon-key-local',
    );
  }

  /// Production configuration.
  factory AppConfig.production({
    String apiUrl = 'https://app.fieldops.com/api/v1',
    String supabaseUrl = 'https://prod-api.fieldops.com/supabase',
    String supabaseAnonKey = 'placeholder-prod-anon-key',
  }) {
    return AppConfig(
      appEnv: 'production',
      apiUrl: apiUrl,
      supabaseUrl: supabaseUrl,
      supabaseAnonKey: supabaseAnonKey,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
    );
  }

  /// Resolve configuration from compile-time environment flags (--dart-define).
  factory AppConfig.fromEnvironment() {
    const env = String.fromEnvironment('APP_ENV', defaultValue: 'development');
    if (env == 'production') {
      return AppConfig.production(
        apiUrl: const String.fromEnvironment(
          'API_URL',
          defaultValue: 'https://app.fieldops.com/api/v1',
        ),
        supabaseUrl: const String.fromEnvironment(
          'SUPABASE_URL',
          defaultValue: 'https://prod-api.fieldops.com/supabase',
        ),
        supabaseAnonKey: const String.fromEnvironment(
          'SUPABASE_ANON_KEY',
          defaultValue: 'placeholder-prod-anon-key',
        ),
      );
    }
    return AppConfig.development();
  }

  bool get isProduction => appEnv == 'production';
}
