# Messenger MVP

Приватный AI-native мессенджер. Flutter (iOS/Android/Web) + TypeScript backend.

[Архитектура](./docs/ai-native-messenger-architecture.ru.md)

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

## Реализовано

- [x] Яндекс OAuth + демо-вход, профиль из аккаунта, сессия в localStorage
- [x] Поиск по имени/телефону (хеш, без хранения номера), авто-слияние аккаунтов
- [x] Персональные чаты, группы, каналы, отправка/редактирование/удаление сообщений
- [x] Reply, реакции (двойной тап/лонг-пресс, 10 эмодзи, чипы)
- [x] Socket.IO realtime — комнаты, авто-реконнект, Redis adapter (N инстансов)
- [x] Push-уведомления (web-push + service worker)
- [x] Офлайн-режим: кеш, очередь сообщений, авто-синк
- [x] PostgreSQL + Redis (сессии, 7d TTL)
- [x] CI/CD (GitHub Actions) + unit-тесты
- [x] Тёмная тема, Telegram-стиль UI

## Масштабируемость

| Компонент | Статус |
|-----------|--------|
| БД | ✅ PostgreSQL |
| Realtime | ✅ Socket.IO + Redis adapter |
| Сессии | ✅ Redis (7d) |
| Файлы | ❌ S3/MinIO |
| События | ❌ NATS |
| Мониторинг | ❌ Prometheus |

**Готовность**: 80%. Можно поднимать N инстансов.

## Структура

```
apps/
├── api_server/     # TypeScript backend (Node 25, Socket.IO, PostgreSQL)
│   └── src/
│       ├── data/        # PostgreSQL + Redis + in-memory fallback
│       ├── domain/      # типы + крипто (хеширование)
│       ├── http/        # JSON/CORS helpers
│       ├── routes/      # auth, chat, push, user
│       └── ws/          # Socket.IO + push-уведомления
└── flutter_app/    # Flutter-клиент (web + mobile)
    └── lib/
        ├── core/api/         # HTTP-клиент (REST)
        ├── core/ws/          # Socket.IO-клиент
        ├── core/offline/     # Офлайн-кеш
        ├── core/storage/     # Персистентность сессии
        ├── features/auth/    # Вход через Яндекс OAuth / demo
        ├── features/chat/    # Чаты, сообщения, реакции, поиск
        └── models/           # User, Chat, Message
```
