import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'task_notifier.dart';
import '../domain/task_models.dart';

class TaskDetailScreen extends ConsumerStatefulWidget {
  final String taskId;

  const TaskDetailScreen({super.key, required this.taskId});

  @override
  ConsumerState<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends ConsumerState<TaskDetailScreen> {
  final TextEditingController _blockedReasonController = TextEditingController();

  @override
  void dispose() {
    _blockedReasonController.dispose();
    super.dispose();
  }

  void _showBlockedDialog(BuildContext context, TaskNotifier notifier) {
    _blockedReasonController.clear();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Mark Task as Blocked'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Specify reason (missing parts, site locked, hazards, etc.):',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _blockedReasonController,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'e.g. Missing replacement gasket',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final reason = _blockedReasonController.text.trim();
              if (reason.isEmpty) return;
              Navigator.pop(ctx);
              await notifier.transitionTaskStatus(
                taskId: widget.taskId,
                targetStatus: TaskStatus.blocked,
                blockedReason: reason,
              );
            },
            child: const Text('Block Task'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final taskState = ref.watch(taskNotifierProvider);
    final notifier = ref.read(taskNotifierProvider.notifier);

    final task = taskState.tasks.firstWhere(
      (t) => t.id == widget.taskId,
      orElse: () => TaskModel(
        id: widget.taskId,
        organizationId: '',
        title: 'Task Not Found',
        status: TaskStatus.draft,
        priority: TaskPriority.low,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      ),
    );

    if (task.title == 'Task Not Found') {
      return Scaffold(
        appBar: AppBar(title: const Text('Task Detail')),
        body: const Center(child: Text('Task not found in local cache.')),
      );
    }

    final incompleteRequired = task.incompleteRequiredCount;
    final isOverdue = task.isOverdue();

    return Scaffold(
      appBar: AppBar(
        title: Text('Task ${task.id}'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Card
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A).withOpacity(0.08),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'STATUS: ${task.status.toDbCode()}',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0284C7).withOpacity(0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '${task.priority.toDbCode()} PRIORITY',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0284C7),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      task.title,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    if (task.description != null && task.description!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        task.description!,
                        style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.4),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Icon(
                          Icons.schedule,
                          size: 14,
                          color: isOverdue ? const Color(0xFFDC2626) : const Color(0xFF64748B),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          task.dueAt != null
                              ? 'Due: ${task.dueAt!.month}/${task.dueAt!.day} ${task.dueAt!.hour.toString().padLeft(2, '0')}:${task.dueAt!.minute.toString().padLeft(2, '0')}'
                              : 'No due date set',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: isOverdue ? FontWeight.bold : FontWeight.normal,
                            color: isOverdue ? const Color(0xFFDC2626) : const Color(0xFF64748B),
                          ),
                        ),
                        if (isOverdue) ...[
                          const SizedBox(width: 6),
                          const Text(
                            '(OVERDUE)',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFDC2626),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Blocked Reason Alert
            if (task.status == TaskStatus.blocked && task.blockedReason != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: Color(0xFFDC2626), size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Blocked: ${task.blockedReason}',
                        style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626), fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Action Buttons
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Actions',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 12),
                    if (task.status == TaskStatus.assigned) ...[
                      ElevatedButton(
                        onPressed: () => notifier.transitionTaskStatus(
                          taskId: widget.taskId,
                          targetStatus: TaskStatus.accepted,
                        ),
                        child: const Text('Accept Task'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: () => notifier.transitionTaskStatus(
                          taskId: widget.taskId,
                          targetStatus: TaskStatus.inProgress,
                        ),
                        child: const Text('Start Work Directly'),
                      ),
                    ],
                    if (task.status == TaskStatus.accepted)
                      ElevatedButton(
                        onPressed: () => notifier.transitionTaskStatus(
                          taskId: widget.taskId,
                          targetStatus: TaskStatus.inProgress,
                        ),
                        child: const Text('Start Work (In Progress)'),
                      ),
                    if (task.status == TaskStatus.inProgress) ...[
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: incompleteRequired > 0 ? Colors.grey : const Color(0xFF16A34A),
                        ),
                        onPressed: () {
                          if (incompleteRequired > 0) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Cannot complete task: $incompleteRequired required checklist items unfinished.',
                                ),
                                backgroundColor: const Color(0xFFDC2626),
                              ),
                            );
                            return;
                          }
                          notifier.transitionTaskStatus(
                            taskId: widget.taskId,
                            targetStatus: TaskStatus.completed,
                          );
                        },
                        child: Text(
                          incompleteRequired > 0
                              ? 'Complete Task ($incompleteRequired Req. Left)'
                              : 'Complete Task',
                        ),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFDC2626),
                        ),
                        onPressed: () => _showBlockedDialog(context, notifier),
                        child: const Text('Mark Blocked...'),
                      ),
                    ],
                    if (task.status == TaskStatus.blocked)
                      ElevatedButton(
                        onPressed: () => notifier.transitionTaskStatus(
                          taskId: widget.taskId,
                          targetStatus: TaskStatus.inProgress,
                        ),
                        child: const Text('Resume Work (In Progress)'),
                      ),
                    if (task.status == TaskStatus.completed)
                      const Text(
                        'Task completed. Excellent work!',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF16A34A),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Checklists Card
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Required Checklist',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          '${task.completedChecklistCount}/${task.totalChecklistCount} completed',
                          style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (task.checklists.isEmpty)
                      const Text(
                        'No checklist items required for this task.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      )
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: task.checklists.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, idx) {
                          final item = task.checklists[idx];
                          return CheckboxListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    item.title,
                                    style: TextStyle(
                                      fontSize: 13,
                                      decoration:
                                          item.isCompleted ? TextDecoration.lineThrough : null,
                                      color: item.isCompleted
                                          ? const Color(0xFF94A3B8)
                                          : const Color(0xFF0F172A),
                                    ),
                                  ),
                                ),
                                if (item.isRequired)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 1,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFEF2F2),
                                      borderRadius: BorderRadius.circular(3),
                                    ),
                                    child: const Text(
                                      'REQ',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFFDC2626),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            value: item.isCompleted,
                            onChanged: (val) {
                              if (val != null) {
                                notifier.toggleChecklistItem(
                                  taskId: widget.taskId,
                                  itemId: item.id,
                                  isCompleted: val,
                                );
                              }
                            },
                          );
                        },
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
