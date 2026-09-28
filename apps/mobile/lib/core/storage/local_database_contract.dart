/// Contract for the offline-first local database.
/// Implemented via SQLite / Drift in Phase 05.
abstract class LocalDatabaseContract {
  /// Initializes the local database and runs pending migrations.
  Future<void> initialize();

  /// Enqueues a local mutation with an idempotency key.
  Future<void> enqueueMutation({
    required String mutationId,
    required String idempotencyKey,
    required String entityType,
    required String entityId,
    required String action,
    required Map<String, dynamic> payload,
    required DateTime clientTimestamp,
  });

  /// Retrieves all pending mutations waiting to sync.
  Future<List<Map<String, dynamic>>> getPendingMutations({int limit = 50});

  /// Marks a mutation as successfully synced and removes it from the active queue.
  Future<void> markMutationSynced(String mutationId);

  /// Clears local tenant data on logout.
  Future<void> clearTenantData();

  /// Closes database connection.
  Future<void> close();
}
