import 'error_codes.dart';

/// Base Failure class for domain and infrastructure errors.
abstract class Failure {
  final String code;
  final String message;
  final String? requestId;

  const Failure({
    required this.code,
    required this.message,
    this.requestId,
  });

  @override
  String toString() => '$runtimeType(code: $code, message: $message, requestId: $requestId)';
}

class NetworkFailure extends Failure {
  const NetworkFailure({
    super.message = 'Network connection unavailable. Operating in offline mode.',
    super.requestId,
  }) : super(
          code: ErrorCodes.networkError,
        );
}

class ServerFailure extends Failure {
  const ServerFailure({
    required super.message,
    super.code = ErrorCodes.internalError,
    super.requestId,
  });
}

class AuthFailure extends Failure {
  const AuthFailure({
    required super.message,
    super.requestId,
  }) : super(
          code: ErrorCodes.authenticationError,
        );
}

class StorageFailure extends Failure {
  const StorageFailure({
    required super.message,
  }) : super(
          code: 'LOCAL_STORAGE_ERROR',
        );
}

class SyncFailure extends Failure {
  final int pendingCount;

  const SyncFailure({
    required super.message,
    required this.pendingCount,
    super.requestId,
  }) : super(
          code: ErrorCodes.syncError,
        );
}

class TaskFailure extends Failure {
  const TaskFailure({
    required super.message,
    super.code = ErrorCodes.taskNotFound,
    super.requestId,
  });
}

