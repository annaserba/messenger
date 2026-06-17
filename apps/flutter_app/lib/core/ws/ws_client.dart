import 'package:socket_io_client/socket_io_client.dart' as io;

class WsClient {
  WsClient({required this.baseUrl});

  final String baseUrl;
  io.Socket? _socket;
  void Function(Map<String, dynamic> event)? _onEvent;
  bool _connected = false;

  bool get isConnected => _connected;

  Future<void> connect({
    required String token,
    required void Function(Map<String, dynamic> event) onEvent,
  }) async {
    _onEvent = onEvent;

    _socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setPath('/ws')
          .enableAutoConnect()
          .disableForceNew()
          .build(),
    );

    _socket!.onConnect((_) {
      _connected = true;
      _socket!.emit('auth', {'token': token});
    });

    _socket!.on('message', (data) {
      if (data is Map) {
        _onEvent?.call(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('reaction', (data) {
      if (data is Map) {
        _onEvent?.call(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('message_edited', (data) {
      if (data is Map) {
        _onEvent?.call(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('message_deleted', (data) {
      if (data is Map) {
        _onEvent?.call(Map<String, dynamic>.from(data));
      }
    });

    _socket!.onDisconnect((_) {
      _connected = false;
    });

    _socket!.onConnectError((_) {
      _connected = false;
    });

    _socket!.connect();
  }

  void joinChat(String chatId) {
    _socket?.emit('join', chatId);
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _connected = false;
    _onEvent = null;
  }
}
