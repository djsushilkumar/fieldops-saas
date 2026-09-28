import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/home_shell_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/org_select_screen.dart';
import '../../features/tasks/presentation/my_tasks_screen.dart';
import '../../features/tasks/presentation/task_detail_screen.dart';
import '../../features/visits/presentation/visits_screen.dart';
import '../../features/visits/presentation/visit_detail_screen.dart';
import '../../features/attendance/presentation/attendance_screen.dart';
import 'route_paths.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: RoutePaths.home,
  routes: [
    GoRoute(
      path: RoutePaths.home,
      builder: (context, state) => const HomeShellScreen(),
    ),
    GoRoute(
      path: RoutePaths.login,
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: RoutePaths.orgSelect,
      builder: (context, state) => const OrgSelectScreen(),
    ),
    GoRoute(
      path: RoutePaths.tasks,
      builder: (context, state) => const MyTasksScreen(),
    ),
    GoRoute(
      path: RoutePaths.taskDetail,
      builder: (context, state) {
        final taskId = state.pathParameters['id'] ?? '';
        return TaskDetailScreen(taskId: taskId);
      },
    ),
    GoRoute(
      path: RoutePaths.visits,
      builder: (context, state) => const VisitsScreen(),
    ),
    GoRoute(
      path: RoutePaths.visitDetail,
      builder: (context, state) {
        final visitId = state.pathParameters['id'] ?? '';
        return VisitDetailScreen(visitId: visitId);
      },
    ),
    GoRoute(
      path: RoutePaths.attendance,
      builder: (context, state) => const AttendanceScreen(),
    ),
  ],
);
