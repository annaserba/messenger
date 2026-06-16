import { createApp } from './app.ts';
import { config } from './config/env.ts';
import { createInMemoryStore } from './data/inMemoryStore.ts';
import { createInMemorySessionStore } from './data/inMemorySessionStore.ts';
import { createWsServer } from './ws/wsServer.ts';
import { createPushStore } from './ws/pushStore.ts';

const store = createInMemoryStore();
const sessionStore = createInMemorySessionStore();
const pushStore = createPushStore(config);
const app = createApp({ config, store, sessionStore, pushStore });

const ws = createWsServer(app.server, sessionStore);
app.setBroadcast((chatId, event) => ws.broadcast(chatId, event as Parameters<typeof ws.broadcast>[1]));

app.server.listen(config.port, '127.0.0.1', () => {
  console.log(`Messenger API listening on http://127.0.0.1:${config.port}`);
  console.log(`WebSocket available at ws://127.0.0.1:${config.port}/ws`);
});
