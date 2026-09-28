/// Stable machine-readable error codes mirroring @fieldops/types.
class ErrorCodes {
  static const String authenticationError = 'AUTHENTICATION_ERROR';
  static const String authorizationError = 'AUTHORIZATION_ERROR';
  static const String validationError = 'VALIDATION_ERROR';
  static const String notFound = 'NOT_FOUND';
  static const String conflict = 'CONFLICT';
  static const String rateLimited = 'RATE_LIMITED';
  static const String networkError = 'NETWORK_ERROR';
  static const String syncError = 'SYNC_ERROR';
  static const String internalError = 'INTERNAL_ERROR';
  static const String tenantNotFound = 'TENANT_NOT_FOUND';
  static const String crossTenantForbidden = 'CROSS_TENANT_FORBIDDEN';
  static const String geofenceException = 'GEOFENCE_EXCEPTION';
  static const String taskNotFound = 'TASK_NOT_FOUND';
  static const String taskAccessDenied = 'TASK_ACCESS_DENIED';
  static const String taskInvalidStatusTransition = 'TASK_INVALID_STATUS_TRANSITION';
  static const String taskInvalidAssignee = 'TASK_INVALID_ASSIGNEE';
  static const String taskConflict = 'TASK_CONFLICT';
  static const String taskChecklistIncomplete = 'TASK_CHECKLIST_INCOMPLETE';
}
