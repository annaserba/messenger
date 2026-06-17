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

- [x] Яндекс OAuth + демо-вход, профиль (имя, email, аватар), сессия в localStorage/файл
- [x] Персональные чаты, группы, каналы (создание, иконки, счётчик участников)
- [x] Поиск пользователей по имени/телефону, старт чата
- [x] Отправка, редактирование (PATCH), удаление (DELETE) сообщений
- [x] Reply к сообщениям (replyTo на бэкенде)
- [x] Реакции: двойной тап 👍, лонг-пресс — 10 эмодзи, чипы со счётчиком
- [x] Socket.IO realtime (room-ы, авто-реконнект, fallback polling)
- [x] Push-уведомления (web-push + service worker)
- [x] Офлайн-режим: кеш в localStorage, очередь сообщений, авто-синк
- [x] PostgreSQL (persistence) с авто-фолбеком на in-memory (CI)
- [x] CI/CD (GitHub Actions): backend smoke test, Flutter analyze + unit-тесты
- [x] Тёмная тема, Telegram-стиль UI

## Оценка масштабируемости

| Компонент | Статус | Что дальше |
|-----------|--------|------------|
| БД | ✅ PostgreSQL | read replicas, партицирование |
| Realtime | ✅ Socket.IO | Redis adapter → N инстансов |
| Сессии | ⚠️ In-memory | Redis / JWT |
| Файлы | ❌ Нет | S3/MinIO + signed URLs |
| События | ❌ Нет | NATS JetStream (push, AI, search) |
| Кеш | ❌ Нет | Redis (горячие данные) |
| Observability | ❌ Нет | Метрики, трейсинг, алерты |

**Готовность**: 60%. Можно поднимать второй инстанс уже сейчас (сессии потеряются, но база общая). После Redis → 80%.

## Структура

```
apps/
├── api_server/     # TypeScript backend (Node 25, Socket.IO, PostgreSQL)
│   └── src/
│       ├── config/      # env-конфигурация (Yandex, VAPID, DB)
│       ├── domain/      # доменные типы (Chat, Message, Reaction)
│       ├── data/        # pgStore (PostgreSQL) + in-memory fallback
│       ├── http/        # JSON/CORS helpers
│       ├── routes/      # auth, chat, push, user routes
│       └── ws/          # Socket.IO сервер + push-уведомления
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
