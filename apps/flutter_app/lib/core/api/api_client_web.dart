// ignore_for_file: deprecated_member_use

import 'dart:convert';
import 'dart:html' as html;

class ApiClient {
  ApiClient({
    this.baseUrl = const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://127.0.0.1:3000',
    ),
  });

  final String baseUrl;
  String? accessToken;

  Future<Map<String, dynamic>> getYandexAuthUrl() {
    return _request('GET', '/api/auth/yandex/url');
  }

  Future<Map<String, dynamic>> signInWithYandexDemo() {
    return _request('POST', '/api/auth/yandex/demo');
  }

  Future<Map<String, dynamic>> fetchMe() {
    return _request('GET', '/api/auth/me');
  }

  Future<Map<String, dynamic>> fetchChats() {
    return _request('GET', '/api/chats');
  }

  Future<Map<String, dynamic>> sendMessage({
    required String chatId,
    required String author,
    required String text,
  }) {
    return _request(
      'POST',
      '/api/chats/$chatId/messages',
      body: {'author': author, 'text': text},
    );
  }

  Future<Map<String, dynamic>> setReaction({
    required String messageId,
    required String reaction,
  }) {
    return _request(
      'POST',
      '/api/messages/$messageId/reaction',
      body: {'reaction': reaction},
    );
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, Object?>? body,
  }) async {
    final request = await html.HttpRequest.request(
      '$baseUrl$path',
      method: method,
      requestHeaders: {
        'Content-Type': 'application/json',
        if (accessToken != null) 'Authorization': 'Bearer $accessToken',
      },
      sendData: body == null ? null : jsonEncode(body),
    );

    final decoded = jsonDecode(
      request.responseText?.isEmpty ?? true ? '{}' : request.responseText!,
    ) as Map<String, dynamic>;
    if (request.status != null && request.status! >= 400) {
      throw Exception(decoded['error'] ?? 'request_failed');
    }
    return decoded;
  }
}
