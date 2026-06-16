// ignore_for_file: deprecated_member_use

import 'dart:html' as html;

class AuthRedirectResult {
  const AuthRedirectResult({
    required this.accessToken,
    required this.name,
  });

  final String accessToken;
  final String name;
}

AuthRedirectResult? readAuthRedirect() {
  final uri = Uri.base;
  if (uri.queryParameters['auth'] != 'yandex') return null;

  final token = uri.queryParameters['token'];
  final name = uri.queryParameters['name'];
  if (token == null || name == null) return null;

  html.window.history.replaceState(null, 'Messenger MVP', uri.path);
  return AuthRedirectResult(accessToken: token, name: name);
}

void openAuthUrl(String url) {
  html.window.location.assign(url);
}
