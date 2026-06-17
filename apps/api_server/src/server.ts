import { createApp } from './app.ts';
import { config } from './config/env.ts';
import { createInMemoryStore, asyncStore } from './data/inMemoryStore.ts';
import { createInMemorySessionStore } from './data/inMemorySessionStore.ts';
import { createRedisSessionStore } from './data/redisSessionStore.ts';
import { createWsServer } from './ws/wsServer.ts';
import { createPushStore } from './ws/pushStore.ts';
import { subscribeToEvents } from './ws/eventBus.ts';
import { createInMemoryUserStore } from './data/userStore.ts';

const userStore = createInMemoryUserStore();
const pushStore = createPushStore(config);

async function main() {
  let store;
  let sessionStore;

  if (process.env.DATABASE_URL) {
    const { createPgStore } = await import('./data/pgStore.ts');
    const pgStore = createPgStore();
    await pgStore.init();
    store = pgStore;
    console.log('Store: PostgreSQL');
  } else {
    store = asyncStore(createInMemoryStore());
    console.log('Store: in-memory');
  }

  try {
    const redisStore = createRedisSessionStore();
    await redisStore.createSession({ id: 'test', name: 'test', provider: 'yandex-demo' as const });
    sessionStore = redisStore;
    console.log('Sessions: Redis');
  } catch {
    sessionStore = createInMemorySessionStore();
    console.log('Sessions: in-memory');
  }

  // Push notification subscriber (async, non-blocking)
  subscribeToEvents('chat:messages', async (event) => {
    if (event.type === 'message_created') {
      for (const userId of event.recipientUserIds) {
        pushStore.send(userId, {
          title: event.chatTitle,
          body: event.text,
          icon: '/favicon.png',
          data: { chatId: event.chatId },
        });
      }
    }
  });

  const app = createApp({ config, store: store as Parameters<typeof createApp>[0]['store'], sessionStore, pushStore, userStore });
  const ws = createWsServer(app.server, sessionStore);
  app.setBroadcast((chatId, event) => ws.broadcast(chatId, event as Parameters<typeof ws.broadcast>[1]));

  app.server.listen(config.port, '127.0.0.1', () => {
    console.log(`Messenger API on http://127.0.0.1:${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
