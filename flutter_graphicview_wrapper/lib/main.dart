import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

void main() {
  runApp(const MaterialApp(home: GraphicViewWrapper()));
}

class GraphicViewWrapper extends StatefulWidget {
  const GraphicViewWrapper({super.key});

  @override
  State<GraphicViewWrapper> createState() => _GraphicViewWrapperState();
}

class _GraphicViewWrapperState extends State<GraphicViewWrapper> {
  late final WebViewController controller;

  @override
  void initState() {
    super.initState();
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            // Update loading bar.
          },
          onPageStarted: (String url) {},
          onPageFinished: (String url) {},
          onWebResourceError: (WebResourceError error) {},
          onNavigationRequest: (NavigationRequest request) {
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadFlutterAsset('assets/www/index.html');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Graphic View Wrapper')),
      body: WebViewWidget(controller: controller),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          final now = DateTime.now().millisecondsSinceEpoch;
          // Create dummy data
          // Structure matches MockAPI: measurementData is array of arrays (segments)
          // realStartTime is array of start times for segments
          // pointInterval is array of steps
          final jsonData =
              '''
          {
            "channel_id": 16,
            "measurementData": [[20, 25, 22, 30, 28, 35, 32, 40, 38, 45, 10, 10, 10, 10]],
            "realStartTime": [$now],
            "pointInterval": [1000], 
            "min": 0,
            "max": 50
          }
          ''';
          controller.runJavaScript('window.updateChannelData(16, $jsonData)');
        },
        child: const Icon(Icons.flash_on),
      ),
    );
  }
}
