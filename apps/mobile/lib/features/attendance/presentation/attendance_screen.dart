import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'attendance_card.dart';
import 'attendance_notifier.dart';

class AttendanceScreen extends ConsumerWidget {
  const AttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(attendanceNotifierProvider);
    final history = state.todayShifts;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Workforce Attendance'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => ref.read(attendanceNotifierProvider.notifier).loadAttendance(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(attendanceNotifierProvider.notifier).loadAttendance(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const AttendanceCard(),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Recent Shift History',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    '${history.length} shift(s)',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (history.isEmpty)
                Container(
                  padding: const EdgeInsets.all(32),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Column(
                    children: [
                      Icon(Icons.history_toggle_off, size: 40, color: Color(0xFF94A3B8)),
                      SizedBox(height: 8),
                      Text(
                        'No shifts recorded yet today',
                        style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Clock in above to start your shift.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: history.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final shift = history[index];
                    final checkInTime = shift.checkInAt.toLocal().toString().substring(11, 16);
                    final checkOutTime = shift.checkOutAt != null
                        ? shift.checkOutAt!.toLocal().toString().substring(11, 16)
                        : 'Active';

                    return Card(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  shift.date,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: shift.isActive
                                        ? const Color(0xFFDCFCE7)
                                        : const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    shift.status.displayName,
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: shift.isActive
                                          ? const Color(0xFF15803D)
                                          : const Color(0xFF475569),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Clock In', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                    const SizedBox(height: 2),
                                    Text(checkInTime, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                  ],
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Clock Out', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                    const SizedBox(height: 2),
                                    Text(checkOutTime, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                  ],
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    const Text('Duration', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                    const SizedBox(height: 2),
                                    Text(
                                      shift.formattedDuration,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                        color: Color(0xFF0284C7),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            if (shift.isManuallyAdjusted) ...[
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFEF3C7),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.info_outline, size: 14, color: Color(0xFFB45309)),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        'Adjusted: ${shift.adjustmentReason ?? 'Supervisor correction'}',
                                        style: const TextStyle(fontSize: 11, color: Color(0xFFB45309)),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}
