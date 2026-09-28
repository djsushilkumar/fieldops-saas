import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/home_shell_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/org_select_screen.dart';
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
  ],
);
