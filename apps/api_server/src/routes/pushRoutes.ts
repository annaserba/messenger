import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SessionStore } from '../data/inMemorySessionStore.ts';
import type { PushStore } from '../ws/pushStore.ts';
import { readJson, sendJson } from '../http/json.ts';

type RouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  sessionStore: SessionStore;
  pushStore: PushStore;
};

export async function handlePushRoutes({ req, res, url, sessionStore, pushStore }: RouteContext): Promise<boolean> {
  if (req.method === 'GET' && url.pathname === '/api/push/key') {
    sendJson(res, 200, { publicKey: pushStore.getPublicKey() });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/push/subscribe') {
    const token = getBearerToken(req);
    const session = token ? await sessionStore.findByToken(token) : null;
    if (!session) { sendJson(res, 401, { error: 'unauthorized' }); return true; }

    const body = await readJson(req);
    const sub = body as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      sendJson(res, 400, { error: 'invalid_subscription' });
      return true;
    }

    pushStore.subscribe(session.user.id, sub as Parameters<PushStore['subscribe']>[1]);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/push/unsubscribe') {
    const token = getBearerToken(req);
    const session = token ? await sessionStore.findByToken(token) : null;
    if (!session) { sendJson(res, 401, { error: 'unauthorized' }); return true; }

    pushStore.unsubscribe(session.user.id);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

function getBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}
