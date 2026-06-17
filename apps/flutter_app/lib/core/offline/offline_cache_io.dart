import 'dart:convert';
import 'dart:io';

String get _dir {
  final home = Platform.environment['HOME'] ?? Platform.environment['USERPROFILE'] ?? '/tmp';
  return '$home/.messenger_cache';
}

Future<void> cacheData(String key, dynamic data) async {
  try {
    final dir = Directory(_dir);
    if (!await dir.exists()) await dir.create(recursive: true);
    final file = File('${dir.path}/$key.json');
    await file.writeAsString(jsonEncode(data));
  } catch (_) {}
}

String? loadCached(String key) {
  try {
    final file = File('${_dir}/$key.json');
    if (file.existsSync()) return file.readAsStringSync();
  } catch (_) {}
  return null;
}

void removeCached(String key) {
  try {
    final file = File('${_dir}/$key.json');
    if (file.existsSync()) file.deleteSync();
  } catch (_) {}
}

bool get isOnline {
  try {
    final result = Process.runSync('ping', ['-c', '1', '-t', '1', '8.8.8.8']);
    return result.exitCode == 0;
  } catch (_) {
    return false;
  }
}
