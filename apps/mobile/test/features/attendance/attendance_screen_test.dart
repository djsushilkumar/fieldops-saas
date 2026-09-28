import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fieldops_mobile/features/attendance/presentation/attendance_card.dart';
import 'package:fieldops_mobile/features/attendance/presentation/attendance_screen.dart';

void main() {
  testWidgets('AttendanceCard renders off-duty state and clock-in CTA initially',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: AttendanceCard(),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('ATTENDANCE & DUTY'), findsOneWidget);
    expect(find.text('OFF DUTY'), findsOneWidget);
    expect(find.text('Ready to begin your workday?'), findsOneWidget);
    expect(find.text('Clock In for Shift'), findsOneWidget);
  });

  testWidgets('AttendanceScreen renders app bar, card, and shift history',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: AttendanceScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Workforce Attendance'), findsOneWidget);
    expect(find.text('ATTENDANCE & DUTY'), findsOneWidget);
    expect(find.text('Recent Shift History'), findsOneWidget);
  });
}
