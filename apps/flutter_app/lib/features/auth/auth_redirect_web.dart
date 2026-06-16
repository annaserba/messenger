// ignore_for_file: deprecated_member_use

import 'dart:html' as html;

class AuthRedirectResult {
  const AuthRedirectResult({required this.accessToken});

  final String accessToken;
}

AuthRedirectResult? readAuthRedirect() {
  final uri = Uri.base;
  if (uri.queryParameters['auth'] != 'yandex') return null;

  final token = uri.queryParameters['token'];
  if (token == null || token.isEmpty) return null;

  html.window.history.replaceState(null, 'Messenger MVP', uri.path);
  return AuthRedirectResult(accessToken: token);
}

void openAuthUrl(String url) {
  html.window.location.assign(url);
}
