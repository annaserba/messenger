// ignore_for_file: deprecated_member_use

import 'dart:convert';
import 'dart:html' as html;

const _storageKey = 'messenger_session';

Future<void> saveSession(Map<String, dynamic> data) async {
  html.window.localStorage[_storageKey] = jsonEncode(data);
}

Future<Map<String, dynamic>?> loadSession() async {
  final raw = html.window.localStorage[_storageKey];
  if (raw == null) return null;
  try {
    return jsonDecode(raw) as Map<String, dynamic>;
  } catch (_) {
    return null;
  }
}

Future<void> clearSession() async {
  html.window.localStorage.remove(_storageKey);
}
