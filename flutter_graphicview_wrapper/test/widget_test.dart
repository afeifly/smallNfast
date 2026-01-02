import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_graphicview_wrapper/main.dart';

void main() {
  testWidgets('App start smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const MaterialApp(home: GraphicViewWrapper()));

    // Verify that our app bar text is present.
    expect(find.text('Graphic View Wrapper'), findsOneWidget);
  });
}
