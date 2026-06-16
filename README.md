# Messenger MVP

Приватный AI-native мессенджер. Flutter (iOS/Android/Web) + TypeScript backend.

[Архитектура](./docs/ai-native-messenger-architecture.ru.md) ·
[Вопросы к собеседованию](./docs/interview-questions.ru.md)

## Быстрый старт

Backend:

```bash
cd apps/api_server
npm run dev
```

Flutter web (в другом терминале):

```bash
cd apps/flutter_app
flutter pub get
flutter run -d web-server --web-hostname 127.0.0.1 --web-port 8080
```

Открыть `http://127.0.0.1:8080`. API на `http://127.0.0.1:3000`.

Без переменных окружения работает демо-вход — MVP запускается сразу.

## Яндекс OAuth

Для реального входа через Яндекс:

```bash
export YANDEX_CLIENT_ID=...
export YANDEX_CLIENT_SECRET=...
export YANDEX_REDIRECT_URI=http://127.0.0.1:3000/api/auth/yandex/callback
export FRONTEND_URL=http://127.0.0.1:8080
```

Профиль заполняется из Яндекс-аккаунта: имя, фамилия, email, аватар. Сессия сохраняется
в localStorage (web) / файл (native) и восстанавливается при перезагрузке.

## Зеркало Flutter

Если Google Cloud Storage недоступен:

```bash
export FLUTTER_STORAGE_BASE_URL="https://storage.flutter-io.cn"
flutter precache
```

## Структура

```
apps/
├── api_server/     # TypeScript backend (Node 25, без фреймворка)
│   └── src/
│       ├── config/      # env-конфигурация
│       ├── domain/      # доменные типы
│       ├── data/        # in-memory хранилища (→ PostgreSQL/Redis)
│       ├── http/        # JSON/CORS helpers
│       └── routes/      # auth, chat endpoints
└── flutter_app/    # Flutter-клиент (нулевые внешние зависимости)
    └── lib/
        ├── core/api/         # HTTP-клиент
        ├── core/storage/     # персистентность сессии
        ├── features/auth/    # вход через Яндекс
        ├── features/chat/    # чаты, сообщения, реакции
        └── models/           # User, Chat, Message
```
