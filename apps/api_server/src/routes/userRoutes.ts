import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SessionStore } from '../data/inMemorySessionStore.ts';
import type { UserStore } from '../data/userStore.ts';
import type { ChatStore } from '../data/pgStore.ts';
import { hashPhone } from '../domain/crypto.ts';
import { sendJson } from '../http/json.ts';

type RouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  sessionStore: SessionStore;
  userStore: UserStore;
  store: ChatStore;
};

export async function handleUserRoutes({ req, res, url, sessionStore, userStore, store }: RouteContext): Promise<boolean> {
  const token = getBearerToken(req);
  const session = token ? sessionStore.findByToken(token) : null;
  if (!session) { sendJson(res, 401, { error: 'unauthorized' }); return true; }

  const myUserId = session.user.id;

  // Search users by name or phone
  if (req.method === 'GET' && url.pathname === '/api/users/search') {
    const q = url.searchParams.get('q') ?? '';
    if (q.length < 2) { sendJson(res, 200, { users: [] }); return true; }

    // Try exact phone match first
    const phoneHash = hashPhone(q);
    if (phoneHash) {
      const byPhone = userStore.findByPhoneHash(phoneHash);
      if (byPhone && byPhone.id !== myUserId) {
        sendJson(res, 200, { users: [{
          id: byPhone.id, name: byPhone.name, firstName: byPhone.firstName,
          lastName: byPhone.lastName, avatarUrl: byPhone.avatarUrl,
        }] });
        return true;
      }
    }

    // Fall back to name search
    const results = userStore.search(q).filter((u) => u.id !== myUserId);
    sendJson(res, 200, { users: results.map((u) => ({
      id: u.id, name: u.name, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl,
    })) });
    return true;
  }

  // Start chat with user
  if (req.method === 'POST' && url.pathname === '/api/chats/start') {
    const body = await readBody(req);
    const targetId = String(body.userId ?? '').trim();
    if (!targetId) { sendJson(res, 400, { error: 'user_id_required' }); return true; }

    const target = userStore.getById(targetId);
    if (!target) { sendJson(res, 404, { error: 'user_not_found' }); return true; }

    const myName = session.user.firstName ?? session.user.name;
    const targetName = target.firstName ?? target.name;

    const chatId = [myUserId, targetId].sort().join(':');
    let chat = await store.findChat(chatId);
    if (!chat) {
      await store.createChat(chatId, targetName, 'personal', myUserId, myName);
      await store.joinChat(chatId, targetId, targetName);
      await store.joinChat(chatId, myUserId, myName);
      chat = await store.findChat(chatId);
    }

    sendJson(res, 200, { chatId, chat: { id: chat.id, title: chat.title } });
    return true;
  }

  return false;
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function getBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}
