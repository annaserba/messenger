import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { handleAuthRoutes } from './routes/authRoutes.ts';
import { handleChatRoutes } from './routes/chatRoutes.ts';
import { handlePushRoutes } from './routes/pushRoutes.ts';
import { handleUserRoutes } from './routes/userRoutes.ts';
import { sendJson } from './http/json.ts';
import type { AppConfig } from './config/env.ts';
import type { ChatStore } from './data/pgStore.ts';
import type { SessionStore } from './data/inMemorySessionStore.ts';
import type { PushStore } from './ws/pushStore.ts';
import type { UserStore } from './data/userStore.ts';

type AppDependencies = {
  config: AppConfig;
  store: ChatStore;
  sessionStore: SessionStore;
  pushStore: PushStore;
  userStore: UserStore;
};

export function createApp({ config, store, sessionStore, pushStore, userStore }: AppDependencies) {
  let _broadcast: ((chatId: string, event: Record<string, unknown>) => void) | null = null;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

      if (req.method === 'OPTIONS') { sendJson(res, 204, {}); return; }
      if (req.method === 'GET' && url.pathname === '/health') { sendJson(res, 200, { ok: true }); return; }

      const broadcast = _broadcast ?? (() => {});
      if (await handleAuthRoutes({ req, res, url, config, sessionStore, userStore })) return;
      if (await handleChatRoutes({ req, res, url, store, sessionStore, broadcast })) return;
      if (await handlePushRoutes({ req, res, url, sessionStore, pushStore })) return;
      if (await handleUserRoutes({ req, res, url, sessionStore, userStore, store })) return;

      sendJson(res, 404, { error: 'not_found' });
    } catch (error) {
      sendJson(res, 500, {
        error: 'internal_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return {
    server,
    setBroadcast(fn: (chatId: string, event: Record<string, unknown>) => void) {
      _broadcast = fn;
    },
  };
}
