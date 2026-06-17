import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SessionStore } from '../data/inMemorySessionStore.ts';
import type { ChatStore } from '../data/pgStore.ts';
import type { ChatType } from '../domain/message.ts';
import { publishEvent } from '../ws/eventBus.ts';
import { readJson, sendJson } from '../http/json.ts';

type RouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  store: ChatStore;
  sessionStore: SessionStore;
  broadcast: (chatId: string, event: Record<string, unknown>) => void;
};

export async function handleChatRoutes({ req, res, url, store, sessionStore, broadcast }: RouteContext): Promise<boolean> {
  // Only check auth for actual chat paths
  const needsAuth = url.pathname.startsWith('/api/chats') || url.pathname.startsWith('/api/messages');
  if (!needsAuth) return false;

  const token = getBearerToken(req);
  const session = token ? await sessionStore.findByToken(token) : null;
  if (!session) { sendJson(res, 401, { error: 'unauthorized' }); return true; }

  const userId = session.user.id;
  const userName = session.user.firstName ?? session.user.name;
  await store.ensureUserChats(userId, userName);

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
    await store.createChat(title, type, userId, userName);
    const chats = await store.listChats(userId);
    const created = chats.at(-1);
    sendJson(res, 201, { chat: created });
    return true;
  }

  const joinMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/join$/);
  if (req.method === 'POST' && joinMatch) {
    await store.joinChat(joinMatch[1] ?? '', userId, userName);
    sendJson(res, 200, { ok: true });
    return true;
  }

  const messageMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/messages$/);
  if (messageMatch) {
    const chatId = messageMatch[1] ?? '';
    const chat = await store.findChat(chatId);
    if (!chat) { sendJson(res, 404, { error: 'chat_not_found' }); return true; }

    if (req.method === 'GET') {
      const chats = await store.listChats(userId);
      const full = chats.find((c) => c.id === chatId);
      sendJson(res, 200, { messages: full?.messages ?? [] });
      return true;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const text = String(body.text ?? '').trim();
      const replyTo = String(body.replyTo ?? '').trim() || undefined;
      if (!text) { sendJson(res, 400, { error: 'text_required' }); return true; }

      const created = await store.addMessage(chatId, userId, userName, text, replyTo);
      if (created) {
        broadcast(chatId, { type: 'message', chatId, message: created });
        const chats = await store.listChats(userId);
        const full = chats.find((c) => c.id === chatId);
        if (full) {
          const recipients = full.participants
            .filter((p) => p.userId !== userId)
            .map((p) => p.userId);
          publishEvent('chat:messages', {
            type: 'message_created',
            chatId,
            messageId: created.id as string,
            authorName: userName,
            text,
            chatTitle: chat.type === 'personal' ? userName : chat.title,
            chatType: chat.type,
            recipientUserIds: recipients,
          });
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
