import 'dart:convert';
import 'dart:io';

const _fileName = '.messenger_session';

String get _storagePath {
  final home = Platform.environment['HOME'] ?? Platform.environment['USERPROFILE'];
  if (home != null) {
    return '$home/$_fileName';
  }
  return '${Directory.systemTemp.path}/$_fileName';
}

Future<void> saveSession(Map<String, dynamic> data) async {
  final file = File(_storagePath);
  await file.writeAsString(jsonEncode(data), flush: true);
}

Future<Map<String, dynamic>?> loadSession() async {
  final file = File(_storagePath);
  if (!await file.exists()) return null;
  try {
    final raw = await file.readAsString();
    return jsonDecode(raw) as Map<String, dynamic>;
  } catch (_) {
    return null;
  }
}

Future<void> clearSession() async {
  final file = File(_storagePath);
  if (await file.exists()) {
    await file.delete();
  }
}
