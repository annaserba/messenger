import type { IncomingMessage, ServerResponse } from 'node:http';

import type { SessionStore } from '../data/inMemorySessionStore.ts';
import type { ChatStore } from '../data/inMemoryStore.ts';
import { readJson, sendJson } from '../http/json.ts';

type RouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  store: ChatStore;
  sessionStore: SessionStore;
  broadcast: (chatId: string, event: Record<string, unknown>) => void;
};

export async function handleChatRoutes({
  req,
  res,
  url,
  store,
  sessionStore,
  broadcast,
}: RouteContext): Promise<boolean> {
  const token = getBearerToken(req);
  const session = token ? sessionStore.findByToken(token) : null;

  if (!session) {
    sendJson(res, 401, { error: 'unauthorized' });
    return true;
  }

  const userId = session.user.id;
  const userName = session.user.firstName ?? session.user.name;

  store.ensureUserChats(userId, userName);

  if (req.method === 'GET' && url.pathname === '/api/chats') {
    sendJson(res, 200, { chats: store.listChats(userId) });
    return true;
  }

  const messageMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/messages$/);
  if (messageMatch) {
    const chatId = messageMatch[1] ?? '';
    const chat = store.findChat(chatId);
    if (!chat) {
      sendJson(res, 404, { error: 'chat_not_found' });
      return true;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, { messages: chat.messages });
      return true;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const text = String(body.text ?? '').trim();

      if (!text) {
        sendJson(res, 400, { error: 'text_required' });
        return true;
      }

      const created = store.addMessage(chatId, userName, text);
      if (created) {
        broadcast(chatId, { type: 'message', chatId, message: created });
      }
      sendJson(res, 201, { message: created });
      return true;
    }
  }

  const reactionMatch = url.pathname.match(/^\/api\/messages\/([^/]+)\/reaction$/);
  if (req.method === 'POST' && reactionMatch) {
    const body = await readJson(req);
    const reaction = String(body.reaction ?? '').trim();
    const target = store.setReaction(reactionMatch[1] ?? '', reaction);

    if (!target) {
      sendJson(res, 404, { error: 'message_not_found' });
      return true;
    }

    const chat = store.findChatByMessage(reactionMatch[1] ?? '');
    if (chat) {
      broadcast(chat.id, { type: 'reaction', chatId: chat.id, message: target });
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
