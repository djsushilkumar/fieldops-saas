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

  bool get isProduction => appEnv == 'production';
}
