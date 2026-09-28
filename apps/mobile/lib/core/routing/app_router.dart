import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'route_paths.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: RoutePaths.home,
  routes: [
    GoRoute(
      path: RoutePaths.home,
      builder: (context, state) => const _ArchitectureShellScreen(title: 'FieldOps Mobile Shell'),
    ),
  ],
);

class _ArchitectureShellScreen extends StatelessWidget {
  final String title;

  const _ArchitectureShellScreen({required this.title});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
      ),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.layers_outlined, size: 48, color: Color(0xFF0F172A)),
              SizedBox(height: 16),
              Text(
                'Phase 02 Architecture Active',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              Text(
                'Mobile foundation initialized with Riverpod, GoRouter, and offline storage contracts.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF64748B)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
