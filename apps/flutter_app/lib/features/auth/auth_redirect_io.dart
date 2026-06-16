class AuthRedirectResult {
  const AuthRedirectResult({required this.accessToken});

  final String accessToken;
}

AuthRedirectResult? readAuthRedirect() => null;

void openAuthUrl(String url) {
  throw UnsupportedError('External browser auth is not implemented for this MVP platform.');
}
