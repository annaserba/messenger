import { createApp } from './app.ts';
import { config } from './config/env.ts';
import { createInMemoryStore } from './data/inMemoryStore.ts';
import { createInMemorySessionStore } from './data/inMemorySessionStore.ts';

const store = createInMemoryStore();
const sessionStore = createInMemorySessionStore();
const server = createApp({ config, store, sessionStore });

server.listen(config.port, '127.0.0.1', () => {
  console.log(`Messenger API listening on http://127.0.0.1:${config.port}`);
});
