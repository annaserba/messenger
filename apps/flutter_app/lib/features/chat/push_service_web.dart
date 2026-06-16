// ignore_for_file: deprecated_member_use

import 'dart:async';
import 'dart:convert';
import 'dart:html' as html;
import 'dart:js' as js;

Future<void> subscribeToPush(String baseUrl, String token) async {
  try {
    final perm = await js.context['Notification'].callMethod('requestPermission');
    if (perm != 'granted') return;

    final swReg = await html.window.navigator.serviceWorker?.register('/sw.js');
    if (swReg == null) return;
    await swReg.update;

    final vapidKey = _toUint8Array('BIYlwyN9j3dkuxT7MgHrCbF9uEJmRYzpJ2AOvHzVTf4poXUK45IqHz3vWIxkOTKqd0Zmc1yGEaxCbj5DjTCicNs');

    final pushManager = js.JsObject.fromBrowserObject(swReg)['pushManager'];
    if (pushManager == null) return;

    final sub = await _promisify(pushManager.callMethod('subscribe', [
      js.JsObject.jsify({
        'userVisibleOnly': true,
        'applicationServerKey': vapidKey,
      }),
    ]));

    final endpoint = sub['endpoint'] as String;
    final rawKey = sub.callMethod('getKey', ['p256dh']);
    final rawAuth = sub.callMethod('getKey', ['auth']);

    String bufToB64(dynamic buf) {
      final list = _toList(buf);
      final chars = String.fromCharCodes(list);
      return html.window.btoa(chars)
          .replaceAll('+', '-')
          .replaceAll('/', '_')
          .replaceAll('=', '');
    }

    final body = jsonEncode({
      'endpoint': endpoint,
      'keys': {'p256dh': bufToB64(rawKey), 'auth': bufToB64(rawAuth)},
    });

    await html.HttpRequest.request(
      '$baseUrl/api/push/subscribe',
      method: 'POST',
      requestHeaders: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      sendData: body,
    );
  } catch (_) {}
}

Future<dynamic> _promisify(dynamic maybePromise) {
  if (maybePromise is Map) return Future.value(maybePromise);
  final completer = Completer();
  js.context.callMethod('Promise.resolve', [maybePromise]).callMethod('then', [
    js.allowInterop((v) => completer.complete(v)),
    js.allowInterop((e) => completer.completeError(e)),
  ]);
  return completer.future;
}

List<int> _toList(dynamic jsArray) {
  final result = <int>[];
  final len = jsArray['length'] as int;
  for (var i = 0; i < len; i++) {
    result.add(jsArray[i] as int);
  }
  return result;
}

dynamic _toUint8Array(String base64) {
  final padded = base64
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padRight(base64.length + (4 - base64.length % 4) % 4, '=');
  final binary = html.window.atob(padded);
  final arr = js.JsArray();
  for (var i = 0; i < binary.length; i++) {
    arr.add(binary.codeUnitAt(i));
  }
  return arr;
}
