import 'package:flutter/foundation.dart';

enum TaskStatus {
  draft,
  assigned,
  accepted,
  inProgress,
  blocked,
  completed,
  canceled;

  static TaskStatus fromString(String val) {
    switch (val.toUpperCase()) {
      case 'DRAFT':
        return TaskStatus.draft;
      case 'ASSIGNED':
        return TaskStatus.assigned;
      case 'ACCEPTED':
        return TaskStatus.accepted;
      case 'IN_PROGRESS':
        return TaskStatus.inProgress;
      case 'BLOCKED':
        return TaskStatus.blocked;
      case 'COMPLETED':
        return TaskStatus.completed;
      case 'CANCELED':
        return TaskStatus.canceled;
      default:
        return TaskStatus.draft;
    }
  }

  String toDbCode() {
    switch (this) {
      case TaskStatus.draft:
        return 'DRAFT';
      case TaskStatus.assigned:
        return 'ASSIGNED';
      case TaskStatus.accepted:
        return 'ACCEPTED';
      case TaskStatus.inProgress:
        return 'IN_PROGRESS';
      case TaskStatus.blocked:
        return 'BLOCKED';
      case TaskStatus.completed:
        return 'COMPLETED';
      case TaskStatus.canceled:
        return 'CANCELED';
    }
  }
}

enum TaskPriority {
  low,
  medium,
  high,
  urgent;

  static TaskPriority fromString(String val) {
    switch (val.toUpperCase()) {
      case 'LOW':
        return TaskPriority.low;
      case 'HIGH':
        return TaskPriority.high;
      case 'URGENT':
        return TaskPriority.urgent;
      case 'MEDIUM':
      default:
        return TaskPriority.medium;
    }
  }

  String toDbCode() {
    switch (this) {
      case TaskPriority.low:
        return 'LOW';
      case TaskPriority.medium:
        return 'MEDIUM';
      case TaskPriority.high:
        return 'HIGH';
      case TaskPriority.urgent:
        return 'URGENT';
    }
  }
}

@immutable
class TaskChecklistItemModel {
  final String id;
  final String taskId;
  final String title;
  final int position;
  final bool isRequired;
  final bool isCompleted;
  final DateTime? completedAt;

  const TaskChecklistItemModel({
    required this.id,
    required this.taskId,
    required this.title,
    required this.position,
    this.isRequired = true,
    this.isCompleted = false,
    this.completedAt,
  });

  TaskChecklistItemModel copyWith({
    String? id,
    String? taskId,
    String? title,
    int? position,
    bool? isRequired,
    bool? isCompleted,
    DateTime? completedAt,
  }) {
    return TaskChecklistItemModel(
      id: id ?? this.id,
      taskId: taskId ?? this.taskId,
      title: title ?? this.title,
      position: position ?? this.position,
      isRequired: isRequired ?? this.isRequired,
      isCompleted: isCompleted ?? this.isCompleted,
      completedAt: completedAt ?? this.completedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'taskId': taskId,
      'title': title,
      'position': position,
      'isRequired': isRequired,
      'isCompleted': isCompleted,
      'completedAt': completedAt?.toIso8601String(),
    };
  }

  factory TaskChecklistItemModel.fromJson(Map<String, dynamic> json) {
    return TaskChecklistItemModel(
      id: json['id'] as String,
      taskId: (json['taskId'] ?? json['task_id'] ?? '') as String,
      title: json['title'] as String,
      position: (json['position'] as num?)?.toInt() ?? 0,
      isRequired: (json['isRequired'] ?? json['is_required'] ?? true) as bool,
      isCompleted: (json['isCompleted'] ?? json['is_completed'] ?? false) as bool,
      completedAt: json['completedAt'] != null || json['completed_at'] != null
          ? DateTime.tryParse((json['completedAt'] ?? json['completed_at']) as String)
          : null,
    );
  }
}

@immutable
class TaskModel {
  final String id;
  final String organizationId;
  final String title;
  final String? description;
  final TaskStatus status;
  final TaskPriority priority;
  final DateTime? dueAt;
  final int version;
  final String? blockedReason;
  final String? assignedTo;
  final List<TaskChecklistItemModel> checklists;
  final DateTime createdAt;
  final DateTime updatedAt;

  const TaskModel({
    required this.id,
    required this.organizationId,
    required this.title,
    this.description,
    required this.status,
    required this.priority,
    this.dueAt,
    this.version = 1,
    this.blockedReason,
    this.assignedTo,
    this.checklists = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  bool isOverdue([DateTime? now]) {
    if (dueAt == null) return false;
    if (status == TaskStatus.completed || status == TaskStatus.canceled) return false;
    final currentTime = now ?? DateTime.now();
    return currentTime.isAfter(dueAt!);
  }

  int get totalChecklistCount => checklists.length;
  int get completedChecklistCount => checklists.where((c) => c.isCompleted).length;
  int get incompleteRequiredCount =>
      checklists.where((c) => c.isRequired && !c.isCompleted).length;

  TaskModel copyWith({
    String? id,
    String? organizationId,
    String? title,
    String? description,
    TaskStatus? status,
    TaskPriority? priority,
    DateTime? dueAt,
    int? version,
    String? blockedReason,
    String? assignedTo,
    List<TaskChecklistItemModel>? checklists,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return TaskModel(
      id: id ?? this.id,
      organizationId: organizationId ?? this.organizationId,
      title: title ?? this.title,
      description: description ?? this.description,
      status: status ?? this.status,
      priority: priority ?? this.priority,
      dueAt: dueAt ?? this.dueAt,
      version: version ?? this.version,
      blockedReason: blockedReason ?? this.blockedReason,
      assignedTo: assignedTo ?? this.assignedTo,
      checklists: checklists ?? this.checklists,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'organizationId': organizationId,
      'title': title,
      'description': description,
      'status': status.toDbCode(),
      'priority': priority.toDbCode(),
      'dueAt': dueAt?.toIso8601String(),
      'version': version,
      'blockedReason': blockedReason,
      'assignedTo': assignedTo,
      'checklists': checklists.map((c) => c.toJson()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    final rawChecklists = json['checklists'] as List<dynamic>? ?? [];
    return TaskModel(
      id: json['id'] as String,
      organizationId: (json['organizationId'] ?? json['organization_id'] ?? '') as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      status: TaskStatus.fromString((json['status'] ?? 'DRAFT') as String),
      priority: TaskPriority.fromString((json['priority'] ?? 'MEDIUM') as String),
      dueAt: json['dueAt'] != null || json['due_at'] != null
          ? DateTime.tryParse((json['dueAt'] ?? json['due_at']) as String)
          : null,
      version: (json['version'] as num?)?.toInt() ?? 1,
      blockedReason: (json['blockedReason'] ?? json['blocked_reason']) as String?,
      assignedTo: (json['assignedTo'] ?? json['assigned_to']) as String?,
      checklists: rawChecklists
          .map((c) => TaskChecklistItemModel.fromJson(c as Map<String, dynamic>))
          .toList(),
      createdAt: DateTime.parse((json['createdAt'] ?? json['created_at']) as String),
      updatedAt: DateTime.parse((json['updatedAt'] ?? json['updated_at']) as String),
    );
  }
}

class TaskTransitionResult {
  final bool isValid;
  final String? errorReason;

  const TaskTransitionResult({required this.isValid, this.errorReason});
}

TaskTransitionResult isValidTaskTransition(
  TaskStatus current,
  TaskStatus target,
  String role, {
  int incompleteRequired = 0,
  String? blockedReason,
  String? reopenReason,
}) {
  if (current == target) {
    return const TaskTransitionResult(isValid: true);
  }

  if (current == TaskStatus.canceled) {
    return const TaskTransitionResult(
      isValid: false,
      errorReason: 'CANCELED is a terminal state.',
    );
  }

  if (target == TaskStatus.canceled) {
    if (role.toUpperCase() == 'FIELD_WORKER') {
      return const TaskTransitionResult(
        isValid: false,
        errorReason: 'Field Workers cannot cancel tasks.',
      );
    }
    return const TaskTransitionResult(isValid: true);
  }

  if (current == TaskStatus.draft && target == TaskStatus.completed) {
    return const TaskTransitionResult(
      isValid: false,
      errorReason: 'Direct transition from DRAFT to COMPLETED is forbidden.',
    );
  }

  if (current == TaskStatus.draft) {
    if (target == TaskStatus.assigned) {
      return const TaskTransitionResult(isValid: true);
    }
    return const TaskTransitionResult(
      isValid: false,
      errorReason: 'DRAFT can only transition to ASSIGNED or CANCELED.',
    );
  }

  if (current == TaskStatus.assigned) {
    if (target == TaskStatus.accepted || target == TaskStatus.inProgress) {
      return const TaskTransitionResult(isValid: true);
    }
    return const TaskTransitionResult(
      isValid: false,
      errorReason: 'ASSIGNED can only transition to ACCEPTED or IN_PROGRESS.',
    );
  }

  if (current == TaskStatus.accepted) {
    if (target == TaskStatus.inProgress) {
      return const TaskTransitionResult(isValid: true);
    }
    return const TaskTransitionResult(
      isValid: false,
      errorReason: 'ACCEPTED can only transition to IN_PROGRESS.',
    );
  }

  if (current == TaskStatus.inProgress) {
    if (target == TaskStatus.blocked) {
      if (blockedReason == null || blockedReason.trim().isEmpty) {
        return const TaskTransitionResult(
          isValid: false,
          errorReason: 'Transitioning to BLOCKED requires a non-empty blocked reason.',
        );
      }
      return const TaskTransitionResult(isValid: true);
    }

    if (target == TaskStatus.completed) {
      if (incompleteRequired > 0) {
        return TaskTransitionResult(
          isValid: false,
          errorReason:
              'Cannot complete task with $incompleteRequired unfinished required checklist items.',
        );
      }
      return const TaskTransitionResult(isValid: true);
    }

    return const TaskTransitionResult(
      isValid: false,
      errorReason: 'IN_PROGRESS can only transition to BLOCKED, COMPLETED, or CANCELED.',
    );
  }

  if (current == TaskStatus.blocked) {
    if (target == TaskStatus.inProgress) {
      return const TaskTransitionResult(isValid: true);
    }
    if (target == TaskStatus.completed) {
      if (incompleteRequired > 0) {
        return TaskTransitionResult(
          isValid: false,
          errorReason:
              'Cannot complete task with $incompleteRequired unfinished required checklist items.',
        );
      }
      return const TaskTransitionResult(isValid: true);
    }
    return const TaskTransitionResult(
      isValid: false,
      errorReason: 'BLOCKED can only transition to IN_PROGRESS or COMPLETED.',
    );
  }

  if (current == TaskStatus.completed) {
    if (target == TaskStatus.inProgress) {
      if (role.toUpperCase() == 'FIELD_WORKER') {
        return const TaskTransitionResult(
          isValid: false,
          errorReason: 'Field Workers cannot reopen completed tasks.',
        );
      }
      return const TaskTransitionResult(isValid: true);
    }
    return const TaskTransitionResult(
      isValid: false,
      errorReason: 'COMPLETED tasks can only be reopened to IN_PROGRESS.',
    );
  }

  return const TaskTransitionResult(isValid: false, errorReason: 'Invalid transition.');
}
