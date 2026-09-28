import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fieldops_mobile/features/visits/presentation/visits_screen.dart';

void main() {
  testWidgets('VisitsScreen renders title and navigation tabs properly',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: VisitsScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Field Visits'), findsOneWidget);
    expect(find.text('Today'), findsOneWidget);
    expect(find.text('Upcoming'), findsOneWidget);
    expect(find.text('Completed'), findsOneWidget);
  });

  testWidgets('VisitsScreen switches tabs when clicked',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: VisitsScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Tap on Completed tab
    final completedTab = find.text('Completed');
    await tester.tap(completedTab);
    await tester.pumpAndSettle();

    // In initial state, completed tab is empty
    expect(find.text('No completed visits yet'), findsOneWidget);
  });
}
