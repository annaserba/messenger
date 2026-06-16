import 'dart:async';
import 'dart:convert';
import 'dart:io';

class WsClient {
  WsClient({required this.baseUrl});

  final String baseUrl;
  WebSocket? _ws;
  StreamSubscription? _sub;
  void Function(Map<String, dynamic> event)? _onEvent;
  bool _connected = false;

  bool get isConnected => _connected;

  Future<void> connect({
    required String token,
    required void Function(Map<String, dynamic> event) onEvent,
  }) async {
    _onEvent = onEvent;
    final wsUrl = baseUrl
        .replaceFirst('http://', 'ws://')
        .replaceFirst('https://', 'wss://');

    try {
      final ws = await WebSocket.connect('$wsUrl/ws');
      _ws = ws;
      _connected = true;

      ws.add(jsonEncode({'type': 'auth', 'token': token}));

      _sub = ws.listen(
        (data) {
          try {
            final event = jsonDecode(data as String) as Map<String, dynamic>;
            _onEvent?.call(event);
          } catch (_) {}
        },
        onError: (_) {
          _connected = false;
          _ws = null;
        },
        onDone: () {
          _connected = false;
          _ws = null;
        },
      );
    } catch (_) {
      _connected = false;
    }
  }

  void disconnect() {
    _sub?.cancel();
    _sub = null;
    _ws?.close();
    _ws = null;
    _connected = false;
    _onEvent = null;
  }
}
