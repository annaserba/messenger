import 'dart:convert';
import 'dart:io';

class ApiClient {
  ApiClient({
    this.baseUrl = const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://127.0.0.1:3000',
    ),
  });

  final String baseUrl;
  final _http = HttpClient();
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
    required String text,
  }) {
    return _request(
      'POST',
      '/api/chats/$chatId/messages',
      body: {'text': text},
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
    final request = await _http.openUrl(method, Uri.parse('$baseUrl$path'));
    request.headers.contentType = ContentType.json;
    if (accessToken != null) {
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $accessToken');
    }
    if (body != null) {
      request.write(jsonEncode(body));
    }

    final response = await request.close();
    final text = await response.transform(utf8.decoder).join();
    final decoded =
        jsonDecode(text.isEmpty ? '{}' : text) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw Exception(decoded['error'] ?? 'request_failed');
    }
    return decoded;
  }
}
