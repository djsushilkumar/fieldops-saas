import 'dart:convert';
import 'package:flutter/foundation.dart';

enum LogLevel { debug, info, warning, error }

class AppLogger {
  static const List<String> _redactedKeys = [
    'password',
    'token',
    'access_token',
    'refresh_token',
    'secret',
    'authorization',
  ];

  static void log(
    LogLevel level,
    String message, {
    Map<String, dynamic>? metadata,
    Object? error,
    StackTrace? stackTrace,
  }) {
    final entry = {
      'timestamp': DateTime.now().toUtc().toIso8601String(),
      'level': level.name.toUpperCase(),
      'message': message,
      if (metadata != null) 'metadata': _redactMetadata(metadata),
      if (error != null) 'error': error.toString(),
    };

    if (kDebugMode) {
      debugPrint('[FieldOps] ${jsonEncode(entry)}');
    }
  }

  static void info(String message, [Map<String, dynamic>? metadata]) =>
      log(LogLevel.info, message, metadata: metadata);

  static void warning(String message, [Map<String, dynamic>? metadata]) =>
      log(LogLevel.warning, message, metadata: metadata);

  static void error(String message, {Object? error, StackTrace? stackTrace, Map<String, dynamic>? metadata}) =>
      log(LogLevel.error, message, error: error, stackTrace: stackTrace, metadata: metadata);

  static Map<String, dynamic> _redactMetadata(Map<String, dynamic> data) {
    final sanitized = <String, dynamic>{};
    for (final entry in data.entries) {
      if (_redactedKeys.any((k) => entry.key.toLowerCase().contains(k))) {
        sanitized[entry.key] = '[REDACTED]';
      } else if (entry.value is Map<String, dynamic>) {
        sanitized[entry.key] = _redactMetadata(entry.value as Map<String, dynamic>);
      } else {
        sanitized[entry.key] = entry.value;
      }
    }
    return sanitized;
  }
}
