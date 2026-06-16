import type { IncomingMessage, ServerResponse } from 'node:http';

import type { ChatStore } from '../data/inMemoryStore.ts';
import { readJson, sendJson } from '../http/json.ts';

type RouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  store: ChatStore;
};

export async function handleChatRoutes({
  req,
  res,
  url,
  store,
}: RouteContext): Promise<boolean> {
  if (req.method === 'GET' && url.pathname === '/api/chats') {
    sendJson(res, 200, { chats: store.listChats() });
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
      const author = String(body.author ?? '').trim();
      const text = String(body.text ?? '').trim();

      if (!author || !text) {
        sendJson(res, 400, { error: 'author_and_text_required' });
        return true;
      }

      const created = store.addMessage(chatId, author, text);
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

    sendJson(res, 200, { message: target });
    return true;
  }

  return false;
}
