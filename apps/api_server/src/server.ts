import { createApp } from './app.ts';
import { config } from './config/env.ts';
import { createInMemoryStore, asyncStore } from './data/inMemoryStore.ts';
import { createRedisSessionStore } from './data/redisSessionStore.ts';
import { createWsServer } from './ws/wsServer.ts';
import { createPushStore } from './ws/pushStore.ts';
import { createInMemoryUserStore } from './data/userStore.ts';

const sessionStore = createRedisSessionStore();
const userStore = createInMemoryUserStore();
const pushStore = createPushStore(config);

async function main() {
  let store;

  if (process.env.DATABASE_URL) {
    const { createPgStore } = await import('./data/pgStore.ts');
    const pgStore = createPgStore();
    await pgStore.init();
    store = pgStore;
    console.log('Using PostgreSQL');
  } else {
    store = asyncStore(createInMemoryStore());
    console.log('Using in-memory store (no DATABASE_URL)');
  }

  const app = createApp({ config, store: store as Parameters<typeof createApp>[0]['store'], sessionStore, pushStore, userStore });
  const ws = createWsServer(app.server, sessionStore);
  app.setBroadcast((chatId, event) => ws.broadcast(chatId, event as Parameters<typeof ws.broadcast>[1]));

  app.server.listen(config.port, '127.0.0.1', () => {
    console.log(`Messenger API on http://127.0.0.1:${config.port} (PostgreSQL + Redis + Socket.IO)`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
