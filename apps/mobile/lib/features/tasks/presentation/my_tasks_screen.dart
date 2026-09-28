import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'task_notifier.dart';
import '../domain/task_models.dart';

class MyTasksScreen extends ConsumerWidget {
  const MyTasksScreen({super.key});

  Color _getStatusColor(TaskStatus status) {
    switch (status) {
      case TaskStatus.draft:
        return const Color(0xFF64748B);
      case TaskStatus.assigned:
        return const Color(0xFF2563EB);
      case TaskStatus.accepted:
        return const Color(0xFF4F46E5);
      case TaskStatus.inProgress:
        return const Color(0xFFD97706);
      case TaskStatus.blocked:
        return const Color(0xFFDC2626);
      case TaskStatus.completed:
        return const Color(0xFF16A34A);
      case TaskStatus.canceled:
        return const Color(0xFF94A3B8);
    }
  }

  Color _getPriorityColor(TaskPriority priority) {
    switch (priority) {
      case TaskPriority.urgent:
        return const Color(0xFFDC2626);
      case TaskPriority.high:
        return const Color(0xFFD97706);
      case TaskPriority.medium:
        return const Color(0xFF0284C7);
      case TaskPriority.low:
        return const Color(0xFF64748B);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final taskState = ref.watch(taskNotifierProvider);
    final notifier = ref.read(taskNotifierProvider.notifier);

    return DefaultTabController(
      length: 4,
      initialIndex: taskState.activeTab.index,
      child: Builder(
        builder: (context) {
          final tabController = DefaultTabController.of(context);
          tabController.addListener(() {
            if (!tabController.indexIsChanging) {
              notifier.setActiveTab(TaskTabFilter.values[tabController.index]);
            }
          });

          return Scaffold(
            appBar: AppBar(
              title: const Text('My Tasks'),
              actions: [
                if (taskState.pendingSyncCount > 0)
                  TextButton.icon(
                    onPressed: () => notifier.syncOfflineQueue(),
                    icon: const Icon(Icons.cloud_upload_outlined, size: 16, color: Colors.orange),
                    label: Text(
                      '${taskState.pendingSyncCount} pending',
                      style: const TextStyle(fontSize: 11, color: Colors.orange),
                    ),
                  )
                else
                  IconButton(
                    icon: const Icon(Icons.sync, size: 20),
                    tooltip: 'Sync Queue',
                    onPressed: () => notifier.syncOfflineQueue(),
                  ),
              ],
              bottom: const TabBar(
                isScrollable: true,
                labelColor: Color(0xFF0F172A),
                indicatorColor: Color(0xFF0F172A),
                tabs: [
                  Tab(text: 'Today'),
                  Tab(text: 'Upcoming'),
                  Tab(text: 'Overdue'),
                  Tab(text: 'Completed'),
                ],
              ),
            ),
            body: RefreshIndicator(
              onRefresh: () => notifier.loadTasks(),
              child: taskState.isLoading && taskState.tasks.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : taskState.filteredTasks.isEmpty
                      ? ListView(
                          children: [
                            const SizedBox(height: 80),
                            Center(
                              child: Column(
                                children: [
                                  Icon(Icons.assignment_outlined, size: 48, color: Colors.grey[400]),
                                  const SizedBox(height: 12),
                                  Text(
                                    'No tasks in ${taskState.activeTab.name}',
                                    style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: taskState.filteredTasks.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final task = taskState.filteredTasks[index];
                            final isOverdue = task.isOverdue();

                            return Card(
                              elevation: 1,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                                side: BorderSide(
                                  color: isOverdue ? const Color(0xFFFECACA) : const Color(0xFFE2E8F0),
                                  width: isOverdue ? 1.5 : 1.0,
                                ),
                              ),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(12),
                                onTap: () => context.push('/tasks/${task.id}'),
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: _getStatusColor(task.status).withOpacity(0.12),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              task.status.toDbCode(),
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.bold,
                                                color: _getStatusColor(task.status),
                                              ),
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 6,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: _getPriorityColor(task.priority).withOpacity(0.12),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              task.priority.toDbCode(),
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.bold,
                                                color: _getPriorityColor(task.priority),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      Text(
                                        task.title,
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF0F172A),
                                        ),
                                      ),
                                      if (task.description != null && task.description!.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          task.description!,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                        ),
                                      ],
                                      const SizedBox(height: 12),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
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
                                                    ? '${task.dueAt!.month}/${task.dueAt!.day} ${task.dueAt!.hour.toString().padLeft(2, '0')}:${task.dueAt!.minute.toString().padLeft(2, '0')}'
                                                    : 'No due date',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: isOverdue ? FontWeight.bold : FontWeight.normal,
                                                  color: isOverdue ? const Color(0xFFDC2626) : const Color(0xFF64748B),
                                                ),
                                              ),
                                            ],
                                          ),
                                          if (task.totalChecklistCount > 0)
                                            Row(
                                              children: [
                                                const Icon(Icons.check_circle_outline, size: 14, color: Color(0xFF64748B)),
                                                const SizedBox(width: 4),
                                                Text(
                                                  '${task.completedChecklistCount}/${task.totalChecklistCount} done',
                                                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                                ),
                                              ],
                                            ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
            ),
          );
        },
      ),
    );
  }
}
