import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../domain/location_models.dart';
import '../domain/visit_models.dart';
import 'visit_notifier.dart';

class VisitsScreen extends ConsumerWidget {
  const VisitsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(visitNotifierProvider);
    final notifier = ref.read(visitNotifierProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Field Visits'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            color: Colors.white,
            child: Row(
              children: [
                _buildTabButton(
                  context,
                  title: 'Today',
                  isSelected: state.activeTab == VisitTabFilter.today,
                  onTap: () => notifier.setTab(VisitTabFilter.today),
                ),
                _buildTabButton(
                  context,
                  title: 'Upcoming',
                  isSelected: state.activeTab == VisitTabFilter.upcoming,
                  onTap: () => notifier.setTab(VisitTabFilter.upcoming),
                ),
                _buildTabButton(
                  context,
                  title: 'Completed',
                  isSelected: state.activeTab == VisitTabFilter.completed,
                  onTap: () => notifier.setTab(VisitTabFilter.completed),
                ),
              ],
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => notifier.loadVisits(),
        child: state.isLoading && state.visits.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : state.filteredVisits.isEmpty
                ? _buildEmptyState(state.activeTab)
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: state.filteredVisits.length,
                    itemBuilder: (context, index) {
                      final visit = state.filteredVisits[index];
                      return _buildVisitCard(context, visit, state.currentCoords);
                    },
                  ),
      ),
    );
  }

  Widget _buildTabButton(
    BuildContext context, {
    required String title,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isSelected ? theme.primaryColor : Colors.transparent,
                width: 2.5,
              ),
            ),
          ),
          child: Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
              color: isSelected ? theme.primaryColor : Colors.grey.shade600,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(VisitTabFilter tab) {
    String label = 'No visits scheduled for today';
    if (tab == VisitTabFilter.upcoming) {
      label = 'No upcoming visits scheduled';
    } else if (tab == VisitTabFilter.completed) {
      label = 'No completed visits yet';
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.location_on_outlined, size: 56, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text(
              label,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Colors.grey.shade700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Assigned field visits will appear here with automated geofence guidance.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVisitCard(
    BuildContext context,
    VisitModel visit,
    GpsCoordinatesModel? currentCoords,
  ) {
    final location = visit.location;
    double? distanceMeters;
    if (location != null && currentCoords != null) {
      distanceMeters = GeofenceService.calculateDistanceMeters(
        currentCoords.latitude,
        currentCoords.longitude,
        location.latitude,
        location.longitude,
      );
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push('/visits/${visit.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      location?.name ?? 'Site Visit',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  _buildStatusChip(visit.status, visit.isOverdue),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                location?.address ?? 'No address provided',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Icons.access_time, size: 14, color: Colors.grey.shade500),
                      const SizedBox(width: 4),
                      Text(
                        _formatTime(visit.scheduledStart),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: Colors.grey.shade800,
                        ),
                      ),
                    ],
                  ),
                  if (distanceMeters != null)
                    Row(
                      children: [
                        Icon(
                          Icons.navigation_outlined,
                          size: 14,
                          color: distanceMeters <= (location?.allowedRadiusMeters ?? 100)
                              ? Colors.green
                              : Colors.blueGrey,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          distanceMeters < 1000
                              ? '${distanceMeters.round()}m away'
                              : '${(distanceMeters / 1000).toStringAsFixed(1)}km away',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: distanceMeters <= (location?.allowedRadiusMeters ?? 100)
                                ? Colors.green.shade700
                                : Colors.blueGrey.shade700,
                          ),
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
  }

  Widget _buildStatusChip(VisitStatus status, bool isOverdue) {
    if (isOverdue && status != VisitStatus.completed && status != VisitStatus.canceled) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: Colors.red.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.red.shade200),
        ),
        child: Text(
          'OVERDUE',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: Colors.red.shade700,
          ),
        ),
      );
    }

    Color bg;
    Color fg;

    switch (status) {
      case VisitStatus.checkedIn:
      case VisitStatus.inProgress:
        bg = Colors.teal.shade50;
        fg = Colors.teal.shade700;
        break;
      case VisitStatus.checkedOut:
        bg = Colors.purple.shade50;
        fg = Colors.purple.shade700;
        break;
      case VisitStatus.completed:
        bg = Colors.green.shade50;
        fg = Colors.green.shade700;
        break;
      case VisitStatus.canceled:
      case VisitStatus.missed:
        bg = Colors.grey.shade100;
        fg = Colors.grey.shade600;
        break;
      case VisitStatus.ready:
      case VisitStatus.enRoute:
        bg = Colors.amber.shade50;
        fg = Colors.amber.shade800;
        break;
      case VisitStatus.scheduled:
      default:
        bg = Colors.blue.shade50;
        fg = Colors.blue.shade700;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status.toDbCode(),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: fg,
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final period = dt.hour >= 12 ? 'PM' : 'AM';
    final minute = dt.minute.toString().padLeft(2, '0');
    return '$hour:$minute $period';
  }
}
