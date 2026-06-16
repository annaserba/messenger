class AuthRedirectResult {
  const AuthRedirectResult({
    required this.accessToken,
    required this.name,
  });

  final String accessToken;
  final String name;
}

AuthRedirectResult? readAuthRedirect() => null;

void openAuthUrl(String url) {
  throw UnsupportedError('External browser auth is not implemented for this MVP platform.');
}
