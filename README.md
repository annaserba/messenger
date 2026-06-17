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

Профиль из Яндекс-аккаунта: имя, фамилия, email, аватар. Сессии в Redis (7 дней).

## Production

```bash
export DATABASE_URL=postgresql://localhost:5432/messenger  # PostgreSQL
export REDIS_URL=redis://localhost:6379                     # Redis (опционально)
export YANDEX_CLIENT_ID=...
export YANDEX_CLIENT_SECRET=...
export PHONE_HASH_SALT=...                                  # секретный ключ для хеша телефона
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
| События | ✅ Redis Pub/Sub |
| Кеш | ✅ Redis |
| Файлы | ❌ S3/MinIO |
| Мониторинг | ❌ Prometheus |

**Готовность**: 90%. Можно поднимать N инстансов.

## Архитектура

```
Flutter ──► Node.js × N (REST + Socket.IO)
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
PostgreSQL    Redis       S3/MinIO
              ├─ сессии
              ├─ realtime (Socket.IO adapter)
              ├─ кеш
              └─ события (Pub/Sub → push, AI, search)
```

Поток сообщения: REST POST → PostgreSQL → Socket.IO broadcast + Redis Pub/Sub → push-уведомления (асинхронно, не блокирует ответ).

## База данных

```sql
users(phone_hash TEXT PK)  -- sha256(phone + SALT), не сам телефон
chats, chat_participants, messages, reactions
```

Все связи по `phone_hash`. Телефон в БД не хранится — только необратимый хеш. При логине
через Яндекс/VK телефон из OAuth хешируется → это ID пользователя. 152-ФЗ соблюдён.

## Структура

```
apps/
├── api_server/     # Node 25, TypeScript, PostgreSQL, Redis, Socket.IO
│   └── src/
│       ├── config/      # env (Yandex, VAPID, DB, SALT)
│       ├── data/        # PostgreSQL + Redis + in-memory fallback
│       ├── domain/      # типы + crypto (sha256 хеширование)
│       ├── http/        # JSON/CORS helpers
│       ├── routes/      # auth, chat, push, user
│       └── ws/          # Socket.IO + event bus (Redis Pub/Sub) + push
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
