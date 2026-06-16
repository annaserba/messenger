import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { handleAuthRoutes } from './routes/authRoutes.ts';
import { handleChatRoutes } from './routes/chatRoutes.ts';
import { sendJson } from './http/json.ts';
import type { AppConfig } from './config/env.ts';
import type { ChatStore } from './data/inMemoryStore.ts';
import type { SessionStore } from './data/inMemorySessionStore.ts';

type AppDependencies = {
  config: AppConfig;
  store: ChatStore;
  sessionStore: SessionStore;
};

export function createApp({ config, store, sessionStore }: AppDependencies) {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

      if (req.method === 'OPTIONS') {
        sendJson(res, 204, {});
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (await handleAuthRoutes({ req, res, url, config, sessionStore })) return;
      if (await handleChatRoutes({ req, res, url, store })) return;

      sendJson(res, 404, { error: 'not_found' });
    } catch (error) {
      sendJson(res, 500, {
        error: 'internal_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
