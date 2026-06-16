import 'package:flutter/material.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen({
    super.key,
    required this.isLoading,
    required this.error,
    required this.onSignIn,
  });

  final bool isLoading;
  final String? error;
  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  CircleAvatar(
                    radius: 34,
                    backgroundColor: Colors.transparent,
                    child: const _AppLogo(size: 68),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Messenger MVP',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Базовая версия с backend и входом через Яндекс.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      error!,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: colors.error),
                    ),
                  ],
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: isLoading ? null : onSignIn,
                    icon: isLoading
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.login),
                    label: const Text('Войти через Яндекс'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AppLogo extends StatelessWidget {
  const _AppLogo({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: const _AppLogoPainter(),
    );
  }
}

class _AppLogoPainter extends CustomPainter {
  const _AppLogoPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final radius = Radius.circular(size.width * 0.22);
    final background = Paint()..color = const Color(0xFF2563EB);
    final shade = Paint()..color = const Color(0xCC1D4ED8);
    final bubble = Paint()..color = Colors.white;
    final line = Paint()..color = const Color(0xFF2563EB);
    final dot = Paint()..color = const Color(0xFF22C55E);
    final dotInner = Paint()..color = Colors.white.withOpacity(0.9);

    canvas.drawRRect(RRect.fromRectAndRadius(rect, radius), background);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(0, size.height * 0.56, size.width, size.height * 0.44),
        radius,
      ),
      shade,
    );

    final bubbleRect = Rect.fromLTWH(
      size.width * 0.24,
      size.height * 0.27,
      size.width * 0.52,
      size.height * 0.38,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        bubbleRect,
        Radius.circular(size.width * 0.1),
      ),
      bubble,
    );

    final tail = Path()
      ..moveTo(size.width * 0.43, size.height * 0.64)
      ..lineTo(size.width * 0.34, size.height * 0.77)
      ..lineTo(size.width * 0.55, size.height * 0.65)
      ..close();
    canvas.drawPath(tail, bubble);

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(
          size.width * 0.34,
          size.height * 0.40,
          size.width * 0.32,
          size.height * 0.05,
        ),
        Radius.circular(size.width * 0.02),
      ),
      line,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(
          size.width * 0.34,
          size.height * 0.51,
          size.width * 0.24,
          size.height * 0.05,
        ),
        Radius.circular(size.width * 0.02),
      ),
      line,
    );

    canvas.drawCircle(
      Offset(size.width * 0.75, size.height * 0.75),
      size.width * 0.07,
      dot,
    );
    canvas.drawCircle(
      Offset(size.width * 0.75, size.height * 0.75),
      size.width * 0.035,
      dotInner,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
