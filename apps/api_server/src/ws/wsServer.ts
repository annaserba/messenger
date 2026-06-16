import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { SessionStore } from '../data/inMemorySessionStore.ts';

type AuthenticatedSocket = WebSocket & { userId?: string };

export type WsContext = {
  broadcast(chatId: string, event: WsEvent): void;
};

export type WsEvent =
  | { type: 'message'; chatId: string; message: Record<string, unknown> }
  | { type: 'reaction'; chatId: string; message: Record<string, unknown> };

export function createWsServer(httpServer: Server, sessionStore: SessionStore): WsContext {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<AuthenticatedSocket>();

  wss.on('connection', (ws: AuthenticatedSocket) => {
    clients.add(ws);

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as { type?: string; token?: string };
        if (data.type === 'auth' && data.token) {
          const session = sessionStore.findByToken(data.token);
          if (session) {
            ws.userId = session.user.id;
            ws.send(JSON.stringify({ type: 'auth_ok', userId: session.user.id }));
          } else {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'invalid token' }));
          }
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  return {
    broadcast(chatId: string, event: WsEvent) {
      const payload = JSON.stringify(event);
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN && client.userId) {
          client.send(payload);
        }
      }
    },
  };
}
