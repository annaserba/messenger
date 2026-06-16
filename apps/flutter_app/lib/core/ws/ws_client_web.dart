// ignore_for_file: deprecated_member_use

import 'dart:async';
import 'dart:convert';
import 'dart:html' as html;

class WsClient {
  WsClient({required this.baseUrl});

  final String baseUrl;
  html.WebSocket? _ws;
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
      final ws = html.WebSocket('$wsUrl/ws');
      _ws = ws;

      ws.onOpen.listen((_) {
        _connected = true;
        ws.send(jsonEncode({'type': 'auth', 'token': token}));
      });

      ws.onMessage.listen((msg) {
        try {
          final event = jsonDecode(msg.data as String) as Map<String, dynamic>;
          _onEvent?.call(event);
        } catch (_) {}
      });

      ws.onClose.listen((_) {
        _connected = false;
        _ws = null;
      });

      ws.onError.listen((_) {
        _connected = false;
        _ws = null;
      });
    } catch (_) {
      _connected = false;
    }
  }

  void disconnect() {
    _ws?.close();
    _ws = null;
    _connected = false;
    _onEvent = null;
  }
}
