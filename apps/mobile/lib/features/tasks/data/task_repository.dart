import '../domain/task_models.dart';
import '../../sync/offline_mutation_queue.dart';
import '../../../core/connectivity/connectivity_service.dart';
import '../../../core/errors/failures.dart';
import '../../../core/errors/error_codes.dart';

class TaskRepository {
  final OfflineMutationQueue _mutationQueue;
  final ConnectivityService _connectivityService;

  // In-memory cache for offline storage simulation
  final Map<String, TaskModel> _cachedTasks = {};

  TaskRepository({
    OfflineMutationQueue? mutationQueue,
    ConnectivityService? connectivityService,
  })  : _mutationQueue = mutationQueue ?? OfflineMutationQueue(),
        _connectivityService = connectivityService ?? MockConnectivityService();

  OfflineMutationQueue get mutationQueue => _mutationQueue;

  void seedInitialTasks(List<TaskModel> tasks) {
    for (final task in tasks) {
      _cachedTasks[task.id] = task;
    }
  }

  Future<List<TaskModel>> fetchMyTasks({
    String? tenantId,
    String? userId,
    bool forceRemote = false,
  }) async {
    // If cache is empty, seed demo data for offline development
    if (_cachedTasks.isEmpty) {
      final now = DateTime.now();
      seedInitialTasks([
        TaskModel(
          id: 'tsk_001',
          organizationId: tenantId ?? 'ten_default',
          title: 'HVAC Air Handler #2 Motor Lubrication',
          description: 'Access rooftop unit, inspect bearings, and apply high-temp grease.',
          status: TaskStatus.inProgress,
          priority: TaskPriority.high,
          dueAt: now.add(const Duration(hours: 3)),
          version: 1,
          assignedTo: userId,
          checklists: const [
            TaskChecklistItemModel(
              id: 'chk_001_1',
              taskId: 'tsk_001',
              title: 'Lockout / Tagout power disconnect',
              position: 1,
              isRequired: true,
              isCompleted: true,
            ),
            TaskChecklistItemModel(
              id: 'chk_001_2',
              taskId: 'tsk_001',
              title: 'Inspect belt tension and alignment',
              position: 2,
              isRequired: true,
              isCompleted: false,
            ),
            TaskChecklistItemModel(
              id: 'chk_001_3',
              taskId: 'tsk_001',
              title: 'Take photo of greased fittings',
              position: 3,
              isRequired: false,
              isCompleted: false,
            ),
          ],
          createdAt: now.subtract(const Duration(days: 1)),
          updatedAt: now.subtract(const Duration(hours: 2)),
        ),
        TaskModel(
          id: 'tsk_002',
          organizationId: tenantId ?? 'ten_default',
          title: 'Emergency Generator Coolant Flange Check',
          description: 'Inspect radiator lower hose flange for reported coolant weeping.',
          status: TaskStatus.assigned,
          priority: TaskPriority.urgent,
          dueAt: now.subtract(const Duration(hours: 1)), // Overdue
          version: 1,
          assignedTo: userId,
          checklists: const [
            TaskChecklistItemModel(
              id: 'chk_002_1',
              taskId: 'tsk_002',
              title: 'Check coolant level and expansion tank',
              position: 1,
              isRequired: true,
              isCompleted: false,
            ),
            TaskChecklistItemModel(
              id: 'chk_002_2',
              taskId: 'tsk_002',
              title: 'Torque flange bolts to 45 ft-lbs',
              position: 2,
              isRequired: true,
              isCompleted: false,
            ),
          ],
          createdAt: now.subtract(const Duration(days: 2)),
          updatedAt: now.subtract(const Duration(days: 1)),
        ),
        TaskModel(
          id: 'tsk_003',
          organizationId: tenantId ?? 'ten_default',
          title: 'Substation Exterior Lighting Safety Inspection',
          description: 'Confirm photocell triggers and replace burnt-out ballast.',
          status: TaskStatus.completed,
          priority: TaskPriority.low,
          dueAt: now.subtract(const Duration(days: 2)),
          version: 2,
          assignedTo: userId,
          checklists: const [
            TaskChecklistItemModel(
              id: 'chk_003_1',
              taskId: 'tsk_003',
              title: 'Test emergency battery pack backup',
              position: 1,
              isRequired: true,
              isCompleted: true,
            ),
          ],
          createdAt: now.subtract(const Duration(days: 3)),
          updatedAt: now.subtract(const Duration(days: 2)),
        ),
      ]);
    }

    return _cachedTasks.values.toList();
  }

  Future<TaskModel> getTask(String taskId) async {
    final cached = _cachedTasks[taskId];
    if (cached != null) {
      return cached;
    }
    throw const TaskFailure(
      code: ErrorCodes.taskNotFound,
      message: 'Task not found in local cache.',
    );
  }

  Future<TaskModel> transitionTaskStatus({
    required String taskId,
    required TaskStatus targetStatus,
    required String userRole,
    required String tenantId,
    required String userId,
    String? blockedReason,
    String? reopenReason,
  }) async {
    final current = await getTask(taskId);

    final incompleteRequired = current.incompleteRequiredCount;
    final transitionCheck = isValidTaskTransition(
      current.status,
      targetStatus,
      userRole,
      incompleteRequired: incompleteRequired,
      blockedReason: blockedReason,
      reopenReason: reopenReason,
    );

    if (!transitionCheck.isValid) {
      throw TaskFailure(
        code: ErrorCodes.taskInvalidStatusTransition,
        message: transitionCheck.errorReason ?? 'Invalid task status transition.',
      );
    }

    // Optimistically update local task
    final updated = current.copyWith(
      status: targetStatus,
      blockedReason: targetStatus == TaskStatus.blocked ? blockedReason : current.blockedReason,
      version: current.version + 1,
      updatedAt: DateTime.now().toUtc(),
    );
    _cachedTasks[taskId] = updated;

    // Enqueue mutation with idempotency key
    await _mutationQueue.enqueue(
      tenantId: tenantId,
      userId: userId,
      entityType: 'task',
      entityId: taskId,
      action: 'transition_status',
      payload: {
        'status': targetStatus.toDbCode(),
        'blockedReason': blockedReason,
        'reopenReason': reopenReason,
        'expectedVersion': current.version,
      },
    );

    return updated;
  }

  Future<TaskModel> toggleChecklistItem({
    required String taskId,
    required String itemId,
    required bool isCompleted,
    required String tenantId,
    required String userId,
  }) async {
    final current = await getTask(taskId);

    final updatedChecklists = current.checklists.map((item) {
      if (item.id == itemId) {
        return item.copyWith(
          isCompleted: isCompleted,
          completedAt: isCompleted ? DateTime.now().toUtc() : null,
        );
      }
      return item;
    }).toList();

    final updated = current.copyWith(
      checklists: updatedChecklists,
      updatedAt: DateTime.now().toUtc(),
    );
    _cachedTasks[taskId] = updated;

    await _mutationQueue.enqueue(
      tenantId: tenantId,
      userId: userId,
      entityType: 'checklist',
      entityId: itemId,
      action: 'toggle_checklist',
      payload: {
        'taskId': taskId,
        'itemId': itemId,
        'isCompleted': isCompleted,
      },
    );

    return updated;
  }

  Future<int> syncPendingMutations() async {
    final isOnline = _connectivityService.isOnline;
    if (!isOnline) {
      return 0; // Offline, mutations stay queued safely
    }

    final pending = _mutationQueue.getPendingMutations();
    if (pending.isEmpty) return 0;

    int syncedCount = 0;
    for (final mutation in pending) {
      _mutationQueue.markSyncing(mutation.mutationId);
      // Simulate successful server synchronization
      _mutationQueue.markSynced(mutation.mutationId);
      syncedCount++;
    }

    _mutationQueue.clearSynced();
    return syncedCount;
  }
}
