import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SessionStore } from '../data/inMemorySessionStore.ts';
import type { ChatStore } from '../data/inMemoryStore.ts';
import type { PushStore } from '../ws/pushStore.ts';
import type { ChatType } from '../domain/message.ts';
import { readJson, sendJson } from '../http/json.ts';

type RouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  store: ChatStore;
  sessionStore: SessionStore;
  broadcast: (chatId: string, event: Record<string, unknown>) => void;
  pushStore: PushStore;
};

export async function handleChatRoutes({ req, res, url, store, sessionStore, broadcast, pushStore }: RouteContext): Promise<boolean> {
  const token = getBearerToken(req);
  const session = token ? sessionStore.findByToken(token) : null;
  if (!session) { sendJson(res, 401, { error: 'unauthorized' }); return true; }

  const userId = session.user.id;
  const userName = session.user.firstName ?? session.user.name;
  store.ensureUserChats(userId, userName);

  if (req.method === 'GET' && url.pathname === '/api/chats') {
    sendJson(res, 200, { chats: store.listChats(userId) });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/chats') {
    const body = await readJson(req);
    const title = String(body.title ?? '').trim();
    const type = (String(body.type ?? 'group').trim()) as ChatType;
    if (!title) { sendJson(res, 400, { error: 'title_required' }); return true; }
    if (!['group', 'channel'].includes(type)) { sendJson(res, 400, { error: 'type_must_be_group_or_channel' }); return true; }
    store.createChat(title, type, userId, userName);
    sendJson(res, 201, { chat: store.listChats(userId).at(-1) });
    return true;
  }

  const joinMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/join$/);
  if (req.method === 'POST' && joinMatch) {
    store.joinChat(joinMatch[1] ?? '', userId, userName);
    sendJson(res, 200, { ok: true });
    return true;
  }

  const messageMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/messages$/);
  if (messageMatch) {
    const chatId = messageMatch[1] ?? '';
    const chat = store.findChat(chatId);
    if (!chat) { sendJson(res, 404, { error: 'chat_not_found' }); return true; }

    if (req.method === 'GET') {
      sendJson(res, 200, { messages: chat.messages });
      return true;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const text = String(body.text ?? '').trim();
      const replyTo = String(body.replyTo ?? '').trim() || undefined;
      if (!text) { sendJson(res, 400, { error: 'text_required' }); return true; }

      const created = store.addMessage(chatId, userName, text, replyTo);
      if (created) {
        broadcast(chatId, { type: 'message', chatId, message: created });
        for (const p of chat.participants) {
          if (p.userId !== userId) {
            pushStore.send(p.userId, {
              title: chat.type === 'personal' ? userName : chat.title,
              body: text, icon: '/favicon.png', data: { chatId },
            });
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
      const updated = store.editMessage(messageMatch[1] ?? '', text);
      if (updated) broadcast(chatId, { type: 'message_edited', chatId, message: updated });
      sendJson(res, 200, { message: updated });
      return true;
    }

    if (req.method === 'DELETE') {
      const deleted = store.deleteMessage(messageMatch[1] ?? '');
      if (deleted) broadcast(chatId, { type: 'message_deleted', chatId, message: { id: messageMatch[1] } });
      sendJson(res, 200, { ok: deleted });
      return true;
    }
  }

  const reactionMatch = url.pathname.match(/^\/api\/messages\/([^/]+)\/reaction$/);
  if (req.method === 'POST' && reactionMatch) {
    const body = await readJson(req);
    const reaction = String(body.reaction ?? '').trim();
    const target = store.setReaction(reactionMatch[1] ?? '', userId, userName, reaction);
    if (!target) { sendJson(res, 404, { error: 'message_not_found' }); return true; }
    const c = store.findChatByMessage(reactionMatch[1] ?? '');
    if (c) broadcast(c.id, { type: 'reaction', chatId: c.id, message: target });
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
