// ignore_for_file: deprecated_member_use

import 'dart:convert';
import 'dart:html' as html;

const _prefix = 'msgr_cache_';

Future<void> cacheData(String key, dynamic data) async {
  try {
    html.window.localStorage['$_prefix$key'] = jsonEncode(data);
  } catch (_) {}
}

String? loadCached(String key) {
  try {
    return html.window.localStorage['$_prefix$key'];
  } catch (_) {
    return null;
  }
}

void removeCached(String key) {
  try {
    html.window.localStorage.remove('$_prefix$key');
  } catch (_) {}
}

bool get isOnline => html.window.navigator.onLine ?? true;
