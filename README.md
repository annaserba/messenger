# AI-native Messenger

Архитектурный репозиторий для приватного AI-native мессенджера для обычных пользователей.

Основной документ:

- [Архитектура AI-native мессенджера](./docs/ai-native-messenger-architecture.ru.md)
- [Что могут спросить на собеседовании](./docs/interview-questions.ru.md)

Проект строится вокруг Flutter-клиентов, NestJS real-time backend, NATS JetStream,
PostgreSQL, Redis, Qdrant, S3-совместимого хранилища, локального AI на устройстве и
self-hosted AI-сервисов. Облачный AI допускается только с явного согласия пользователя.

## Текущая базовая версия

Минимальное Flutter-приложение находится в `apps/flutter_app`.

Запуск TypeScript backend:

```bash
cd apps/api_server
npm run dev
```

Запуск web-версии в другом терминале:

```bash
cd apps/flutter_app
flutter pub get
flutter run -d web-server --web-hostname 127.0.0.1 --web-port 8080
```

После запуска откройте `http://127.0.0.1:8080`.

Backend API будет доступен на `http://127.0.0.1:3000`.

Для настоящего Яндекс OAuth нужно зарегистрировать приложение в Яндекс OAuth и передать backend:

- `YANDEX_CLIENT_ID`
- `YANDEX_CLIENT_SECRET`
- `YANDEX_REDIRECT_URI`
- `FRONTEND_URL`

Без этих переменных работает демо-вход через Яндекс, чтобы MVP запускался сразу.

### Профиль из Яндекс ID

При входе через Яндекс (или демо) профиль пользователя заполняется данными из Яндекс-аккаунта:
имя, фамилия, email и аватар. Эти данные отображаются в сайдбаре и сохраняются в
localStorage (web) / файл (native) — сессия восстанавливается при перезагрузке приложения.

### Зеркало Flutter

Если Google Cloud Storage недоступен, используйте зеркало:

```bash
export FLUTTER_STORAGE_BASE_URL="https://storage.flutter-io.cn"
flutter precache
flutter run -d web-server --web-hostname 127.0.0.1 --web-port 8080
```

Backend уже разложен под рост:

- `src/config` — конфигурация окружения.
- `src/domain` — доменные типы и фабрики.
- `src/data` — временные in-memory хранилища, которые позже заменяются PostgreSQL/Redis.
- `src/http` — общие HTTP helpers.
- `src/routes` — route handlers по функциональным зонам.
- `src/server.ts` — точка входа.

Сейчас TypeScript запускается напрямую через Node 25 без отдельной сборки. Позже можно заменить этот режим на NestJS или обычную сборку `tsc` без изменения публичных API-контрактов.
