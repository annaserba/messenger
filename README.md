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

## Реализовано

### Аутентификация
- [x] Вход через Яндекс OAuth (с редиректом и обменом кода на токен)
- [x] Демо-вход без настройки переменных окружения
- [x] Профиль из Яндекс-аккаунта: имя, фамилия, email, аватар
- [x] Сохранение сессии в localStorage / файл — восстановление при перезагрузке
- [x] Кнопка выхода

### Чаты
- [x] Персональный чат для каждого пользователя (автосоздание)
- [x] Группы — несколько участников, все могут писать
- [x] Каналы — только создатель пишет, остальные читают
- [x] Кнопка «+» для создания группы или канала
- [x] Отображение типа чата (иконка группы/канала) и количества участников
- [x] Список чатов загружается с backend, у каждого пользователя свой

### Сообщения
- [x] Отправка текстовых сообщений
- [x] Автор сообщения определяется из сессии (не передаётся клиентом)
- [x] Двойной тап — быстрая реакция 👍
- [x] Лонг-пресс — панель из 10 эмодзи (👍 ❤️ 😂 😮 😢 🙏 👏 🔥 🎉 💯)
- [x] Несколько реакций от разных пользователей на одно сообщение
- [x] Чипы с эмодзи и счётчиком на пузыре сообщения
- [x] Отображение времени сообщений

### Realtime
- [x] WebSocket-сервер на `/ws` (библиотека `ws`)
- [x] Мгновенная доставка новых сообщений и реакций всем участникам
- [x] Аутентификация WebSocket-соединения по токену

### Архитектура
- [x] REST API для команд и загрузки данных
- [x] WebSocket для realtime-событий
- [x] CORS, JSON-ответы, обработка ошибок
- [x] In-memory хранилище (готово к замене на PostgreSQL/Redis)

## Структура

```
apps/
├── api_server/     # TypeScript backend (Node 25, ws)
│   └── src/
│       ├── config/      # env-конфигурация
│       ├── domain/      # доменные типы (Chat, Message, Reaction)
│       ├── data/        # in-memory хранилища (→ PostgreSQL/Redis)
│       ├── http/        # JSON/CORS helpers
│       ├── routes/      # auth, chat endpoints
│       └── ws/          # WebSocket-сервер
└── flutter_app/    # Flutter-клиент (нулевые внешние зависимости)
    └── lib/
        ├── core/api/         # HTTP-клиент (REST)
        ├── core/ws/          # WebSocket-клиент
        ├── core/storage/     # персистентность сессии
        ├── features/auth/    # вход через Яндекс OAuth / demo
        ├── features/chat/    # чаты, сообщения, реакции
        └── models/           # User, Chat, Message
```
