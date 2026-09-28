import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/routing/route_paths.dart';
import 'auth_notifier.dart';

class OrgSelectScreen extends ConsumerWidget {
  const OrgSelectScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final memberships = authState.memberships;
    final activeOrgId = authState.activeMembership?.organizationId;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Select Organization'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign Out',
            onPressed: () async {
              await ref.read(authNotifierProvider.notifier).signOut();
              if (context.mounted) {
                context.go(RoutePaths.login);
              }
            },
          ),
        ],
      ),
      body: memberships.isEmpty
          ? const Center(
              child: Text('No active organization memberships found.'),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: memberships.length,
              itemBuilder: (context, index) {
                final membership = memberships[index];
                final isCurrent = membership.organizationId == activeOrgId;
                final orgName = membership.organization?.name ??
                    'Organization ${membership.organizationId.substring(0, 8)}';

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                    side: BorderSide(
                      color: isCurrent
                          ? const Color(0xFF0F172A)
                          : const Color(0xFFE2E8F0),
                      width: isCurrent ? 2 : 1,
                    ),
                  ),
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(16),
                    title: Text(
                      orgName,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Padding(
                      padding: const EdgeInsets.only(top: 4.0),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              membership.role,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF475569),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            membership.status,
                            style: TextStyle(
                              fontSize: 11,
                              color: membership.status == 'ACTIVE'
                                  ? const Color(0xFF16A34A)
                                  : const Color(0xFFD97706),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    trailing: isCurrent
                        ? const Icon(Icons.check_circle, color: Color(0xFF0F172A))
                        : const Icon(Icons.chevron_right),
                    onTap: () async {
                      await ref
                          .read(authNotifierProvider.notifier)
                          .switchOrganization(membership.organizationId);
                      if (context.mounted) {
                        context.go(RoutePaths.home);
                      }
                    },
                  ),
                );
              },
            ),
    );
  }
}
