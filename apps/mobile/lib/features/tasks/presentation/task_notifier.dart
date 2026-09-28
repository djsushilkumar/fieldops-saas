import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/task_models.dart';
import '../data/task_repository.dart';
import '../../auth/presentation/auth_notifier.dart';

enum TaskTabFilter {
  today,
  upcoming,
  overdue,
  completed,
}

@immutable
class TaskState {
  final bool isLoading;
  final List<TaskModel> tasks;
  final TaskTabFilter activeTab;
  final int pendingSyncCount;
  final String? errorMessage;
  final String? successMessage;

  const TaskState({
    this.isLoading = false,
    this.tasks = const [],
    this.activeTab = TaskTabFilter.today,
    this.pendingSyncCount = 0,
    this.errorMessage,
    this.successMessage,
  });

  TaskState copyWith({
    bool? isLoading,
    List<TaskModel>? tasks,
    TaskTabFilter? activeTab,
    int? pendingSyncCount,
    String? errorMessage,
    String? successMessage,
    bool clearError = false,
    bool clearSuccess = false,
  }) {
    return TaskState(
      isLoading: isLoading ?? this.isLoading,
      tasks: tasks ?? this.tasks,
      activeTab: activeTab ?? this.activeTab,
      pendingSyncCount: pendingSyncCount ?? this.pendingSyncCount,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      successMessage: clearSuccess ? null : (successMessage ?? this.successMessage),
    );
  }

  List<TaskModel> get filteredTasks {
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final todayEnd = todayStart.add(const Duration(days: 1));

    switch (activeTab) {
      case TaskTabFilter.today:
        return tasks.where((t) {
          if (t.status == TaskStatus.completed || t.status == TaskStatus.canceled) {
            return false;
          }
          if (t.dueAt == null) return true;
          return t.dueAt!.isAfter(todayStart) && t.dueAt!.isBefore(todayEnd);
        }).toList();

      case TaskTabFilter.upcoming:
        return tasks.where((t) {
          if (t.status == TaskStatus.completed || t.status == TaskStatus.canceled) {
            return false;
          }
          if (t.dueAt == null) return false;
          return t.dueAt!.isAfter(todayEnd);
        }).toList();

      case TaskTabFilter.overdue:
        return tasks.where((t) => t.isOverdue(now)).toList();

      case TaskTabFilter.completed:
        return tasks.where((t) => t.status == TaskStatus.completed).toList();
    }
  }
}

final taskRepositoryProvider = Provider<TaskRepository>((ref) {
  return TaskRepository();
});

class TaskNotifier extends StateNotifier<TaskState> {
  final TaskRepository _repository;
  final Ref _ref;

  TaskNotifier(this._repository, this._ref) : super(const TaskState()) {
    loadTasks();
  }

  void setActiveTab(TaskTabFilter tab) {
    state = state.copyWith(activeTab: tab);
  }

  Future<void> loadTasks() async {
    state = state.copyWith(isLoading: true, clearError: true);
    final authState = _ref.read(authNotifierProvider);
    final tenantId = authState.activeMembership?.organizationId;
    final userId = authState.user?.id;

    try {
      final tasks = await _repository.fetchMyTasks(
        tenantId: tenantId,
        userId: userId,
      );
      state = state.copyWith(
        isLoading: false,
        tasks: tasks,
        pendingSyncCount: _repository.mutationQueue.pendingCount,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
    }
  }

  Future<bool> transitionTaskStatus({
    required String taskId,
    required TaskStatus targetStatus,
    String? blockedReason,
    String? reopenReason,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true, clearSuccess: true);
    final authState = _ref.read(authNotifierProvider);
    final role = authState.activeMembership?.role ?? 'FIELD_WORKER';
    final tenantId = authState.activeMembership?.organizationId ?? 'default';
    final userId = authState.user?.id ?? 'default';

    try {
      final updated = await _repository.transitionTaskStatus(
        taskId: taskId,
        targetStatus: targetStatus,
        userRole: role,
        tenantId: tenantId,
        userId: userId,
        blockedReason: blockedReason,
        reopenReason: reopenReason,
      );

      final updatedList = state.tasks.map((t) => t.id == taskId ? updated : t).toList();

      state = state.copyWith(
        isLoading: false,
        tasks: updatedList,
        pendingSyncCount: _repository.mutationQueue.pendingCount,
        successMessage: 'Status changed to ${targetStatus.name}',
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  Future<void> toggleChecklistItem({
    required String taskId,
    required String itemId,
    required bool isCompleted,
  }) async {
    final authState = _ref.read(authNotifierProvider);
    final tenantId = authState.activeMembership?.organizationId ?? 'default';
    final userId = authState.user?.id ?? 'default';

    try {
      final updated = await _repository.toggleChecklistItem(
        taskId: taskId,
        itemId: itemId,
        isCompleted: isCompleted,
        tenantId: tenantId,
        userId: userId,
      );

      final updatedList = state.tasks.map((t) => t.id == taskId ? updated : t).toList();
      state = state.copyWith(
        tasks: updatedList,
        pendingSyncCount: _repository.mutationQueue.pendingCount,
      );
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
    }
  }

  Future<void> syncOfflineQueue() async {
    final synced = await _repository.syncPendingMutations();
    state = state.copyWith(
      pendingSyncCount: _repository.mutationQueue.pendingCount,
      successMessage: synced > 0 ? '$synced mutations synchronized' : null,
    );
  }
}

final taskNotifierProvider = StateNotifierProvider<TaskNotifier, TaskState>((ref) {
  final repo = ref.watch(taskRepositoryProvider);
  return TaskNotifier(repo, ref);
});
