import 'package:flutter_test/flutter_test.dart';
import 'package:fieldops_mobile/features/tasks/domain/task_models.dart';

void main() {
  group('TaskModel & State Machine in Dart', () {
    test('serializes and deserializes correctly', () {
      final now = DateTime.utc(2026, 9, 28, 12, 0, 0);
      final task = TaskModel(
        id: 'tsk_101',
        organizationId: 'ten_01',
        title: 'Inspect Emergency Breaker',
        description: 'Check fuses and inspect coil.',
        status: TaskStatus.inProgress,
        priority: TaskPriority.urgent,
        dueAt: now.add(const Duration(hours: 4)),
        version: 2,
        checklists: const [
          TaskChecklistItemModel(
            id: 'chk_1',
            taskId: 'tsk_101',
            title: 'Verify line voltage is 0V',
            position: 1,
            isRequired: true,
            isCompleted: true,
          ),
          TaskChecklistItemModel(
            id: 'chk_2',
            taskId: 'tsk_101',
            title: 'Photograph replaced fuses',
            position: 2,
            isRequired: false,
            isCompleted: false,
          ),
        ],
        createdAt: now.subtract(const Duration(days: 1)),
        updatedAt: now,
      );

      final json = task.toJson();
      expect(json['id'], 'tsk_101');
      expect(json['status'], 'IN_PROGRESS');
      expect(json['priority'], 'URGENT');
      expect((json['checklists'] as List).length, 2);

      final parsed = TaskModel.fromJson(json);
      expect(parsed.id, 'tsk_101');
      expect(parsed.title, 'Inspect Emergency Breaker');
      expect(parsed.status, TaskStatus.inProgress);
      expect(parsed.priority, TaskPriority.urgent);
      expect(parsed.checklists.length, 2);
      expect(parsed.checklists.first.isRequired, true);
      expect(parsed.checklists.first.isCompleted, true);
    });

    test('correctly evaluates overdue tasks', () {
      final now = DateTime.utc(2026, 9, 28, 12, 0, 0);
      final pastDue = TaskModel(
        id: 'tsk_past',
        organizationId: 'ten_01',
        title: 'Past Task',
        status: TaskStatus.inProgress,
        priority: TaskPriority.medium,
        dueAt: now.subtract(const Duration(hours: 1)),
        createdAt: now.subtract(const Duration(days: 1)),
        updatedAt: now,
      );

      final futureDue = TaskModel(
        id: 'tsk_future',
        organizationId: 'ten_01',
        title: 'Future Task',
        status: TaskStatus.inProgress,
        priority: TaskPriority.medium,
        dueAt: now.add(const Duration(hours: 1)),
        createdAt: now.subtract(const Duration(days: 1)),
        updatedAt: now,
      );

      final completedPast = TaskModel(
        id: 'tsk_done',
        organizationId: 'ten_01',
        title: 'Done Task',
        status: TaskStatus.completed,
        priority: TaskPriority.medium,
        dueAt: now.subtract(const Duration(hours: 1)),
        createdAt: now.subtract(const Duration(days: 1)),
        updatedAt: now,
      );

      expect(pastDue.isOverdue(now), true);
      expect(futureDue.isOverdue(now), false);
      expect(completedPast.isOverdue(now), false);
    });

    test('validates lifecycle transition rules', () {
      // 1. Worker cannot cancel
      final cancelResult = isValidTaskTransition(
        TaskStatus.inProgress,
        TaskStatus.canceled,
        'FIELD_WORKER',
      );
      expect(cancelResult.isValid, false);
      expect(cancelResult.errorReason, contains('Field Workers cannot cancel tasks'));

      // 2. Supervisor can cancel
      final supCancel = isValidTaskTransition(
        TaskStatus.inProgress,
        TaskStatus.canceled,
        'SUPERVISOR',
      );
      expect(supCancel.isValid, true);

      // 3. Incomplete required checklists blocks completion
      final incompleteComplete = isValidTaskTransition(
        TaskStatus.inProgress,
        TaskStatus.completed,
        'FIELD_WORKER',
        incompleteRequired: 1,
      );
      expect(incompleteComplete.isValid, false);
      expect(incompleteComplete.errorReason, contains('unfinished required checklist items'));

      // 4. Zero incomplete required checklists allows completion
      final validComplete = isValidTaskTransition(
        TaskStatus.inProgress,
        TaskStatus.completed,
        'FIELD_WORKER',
        incompleteRequired: 0,
      );
      expect(validComplete.isValid, true);

      // 5. BLOCKED requires a reason
      final blockedNoReason = isValidTaskTransition(
        TaskStatus.inProgress,
        TaskStatus.blocked,
        'FIELD_WORKER',
      );
      expect(blockedNoReason.isValid, false);
      expect(blockedNoReason.errorReason, contains('requires a non-empty blocked reason'));

      final blockedWithReason = isValidTaskTransition(
        TaskStatus.inProgress,
        TaskStatus.blocked,
        'FIELD_WORKER',
        blockedReason: 'Circuit live, awaiting lockout authorization',
      );
      expect(blockedWithReason.isValid, true);

      // 6. Worker cannot reopen completed task
      final workerReopen = isValidTaskTransition(
        TaskStatus.completed,
        TaskStatus.inProgress,
        'FIELD_WORKER',
      );
      expect(workerReopen.isValid, false);

      final supReopen = isValidTaskTransition(
        TaskStatus.completed,
        TaskStatus.inProgress,
        'SUPERVISOR',
      );
      expect(supReopen.isValid, true);
    });
  });
}
