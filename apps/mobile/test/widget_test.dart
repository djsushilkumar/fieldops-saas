import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fieldops_mobile/main.dart';

void main() {
  testWidgets('FieldOpsMobileApp mounts and renders architecture shell', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: FieldOpsMobileApp(),
      ),
    );

    // Verify shell screen title and status text render
    expect(find.text('FieldOps Mobile Shell'), findsOneWidget);
    expect(find.text('Phase 02 Architecture Active'), findsOneWidget);
  });
}
