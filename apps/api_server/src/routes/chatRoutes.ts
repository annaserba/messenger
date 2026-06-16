import type { IncomingMessage, ServerResponse } from 'node:http';

import type { SessionStore } from '../data/inMemorySessionStore.ts';
import type { PushStore } from '../ws/pushStore.ts';
import type { ChatType } from '../domain/message.ts';
import { readJson, sendJson } from '../http/json.ts';

type PgStore = import('../data/pgStore.ts').ChatStore;

type RouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  store: PgStore;
  sessionStore: SessionStore;
  broadcast: (chatId: string, event: Record<string, unknown>) => void;
  pushStore: PushStore;
};

export async function handleChatRoutes({
  req,
  res,
  url,
  store,
  sessionStore,
  broadcast,
  pushStore,
}: RouteContext): Promise<boolean> {
  const token = getBearerToken(req);
  const session = token ? sessionStore.findByToken(token) : null;

  if (!session) {
    sendJson(res, 401, { error: 'unauthorized' });
    return true;
  }

  const userId = session.user.id;
  const userName = session.user.firstName ?? session.user.name;
  const userEmail = session.user.email;
  const avatarUrl = session.user.avatarUrl;
  const firstName = session.user.firstName;
  const lastName = session.user.lastName;

  await store.ensureUserChats(userId, userName, userEmail, avatarUrl, firstName, lastName);

  if (req.method === 'GET' && url.pathname === '/api/chats') {
    sendJson(res, 200, { chats: await store.listChats(userId) });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/chats') {
    const body = await readJson(req);
    const title = String(body.title ?? '').trim();
    const type = (String(body.type ?? 'group').trim()) as ChatType;

    if (!title) { sendJson(res, 400, { error: 'title_required' }); return true; }
    if (!['group', 'channel'].includes(type)) { sendJson(res, 400, { error: 'type_must_be_group_or_channel' }); return true; }

    const chat = await store.createChat(title, type, userId, userName);
    sendJson(res, 201, { chat });
    return true;
  }

  const joinMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/join$/);
  if (req.method === 'POST' && joinMatch) {
    const chat = await store.joinChat(joinMatch[1] ?? '', userId, userName);
    if (!chat) { sendJson(res, 404, { error: 'chat_not_found' }); return true; }
    sendJson(res, 200, { chat });
    return true;
  }

  const messageMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/messages$/);
  if (messageMatch) {
    const chatId = messageMatch[1] ?? '';
    const chat = await store.findChat(chatId);
    if (!chat) { sendJson(res, 404, { error: 'chat_not_found' }); return true; }

    if (req.method === 'GET') {
      const result = await store.listChats(userId);
      const found = result.find((c) => c.id === chatId);
      sendJson(res, 200, { messages: found?.messages ?? [] });
      return true;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const text = String(body.text ?? '').trim();
      const replyTo = String(body.replyTo ?? '').trim() || undefined;

      if (!text) { sendJson(res, 400, { error: 'text_required' }); return true; }

      const created = await store.addMessage(chatId, userName, text, replyTo);
      if (created) {
        broadcast(chatId, { type: 'message', chatId, message: created });
        const c = await store.findChat(chatId);
        if (c) {
          const parts = await store.listChats(userId);
          const fullChat = parts.find((cc) => cc.id === chatId);
          if (fullChat) {
            for (const p of fullChat.participants) {
              if (p.userId !== userId) {
                pushStore.send(p.userId, {
                  title: c.type === 'personal' ? userName : c.title,
                  body: text,
                  icon: '/favicon.png',
                  data: { chatId },
                });
              }
            }
          }
        }
      }
      sendJson(res, 201, { message: created });
      return true;
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const text = String(body.text ?? '').trim();
      if (!text) { sendJson(res, 400, { error: 'text_required' }); return true; }
      const updated = await store.editMessage(messageMatch[1] ?? '', text);
      if (updated) broadcast(chatId, { type: 'message_edited', chatId, message: updated });
      sendJson(res, 200, { message: updated });
      return true;
    }

    if (req.method === 'DELETE') {
      const deleted = await store.deleteMessage(messageMatch[1] ?? '');
      if (deleted) broadcast(chatId, { type: 'message_deleted', chatId, message: { id: messageMatch[1] } });
      sendJson(res, 200, { ok: deleted });
      return true;
    }
  }

  const reactionMatch = url.pathname.match(/^\/api\/messages\/([^/]+)\/reaction$/);
  if (req.method === 'POST' && reactionMatch) {
    const body = await readJson(req);
    const reaction = String(body.reaction ?? '').trim();
    const target = await store.setReaction(reactionMatch[1] ?? '', userId, userName, reaction);
    if (!target) { sendJson(res, 404, { error: 'message_not_found' }); return true; }

    // Find chat for broadcast
    const chats = await store.listChats(userId);
    for (const c of chats) {
      if (c.messages.some((m) => m.id === reactionMatch[1])) {
        broadcast(c.id, { type: 'reaction', chatId: c.id, message: target });
        break;
      }
    }
    sendJson(res, 200, { message: target });
    return true;
  }

  return false;
}

function getBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}
