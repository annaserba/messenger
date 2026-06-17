import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { SessionStore } from '../data/inMemorySessionStore.ts';

export type WsContext = {
  broadcast(chatId: string, event: Record<string, unknown>): void;
};

export function createWsServer(httpServer: HttpServer, sessionStore: SessionStore): WsContext {
  const io = new SocketIOServer(httpServer, {
    path: '/ws',
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    socket.on('auth', (data: { token: string }) => {
      const session = sessionStore.findByToken(data.token);
      if (session) {
        socket.data.userId = session.user.id;
        socket.join(session.user.id);
        socket.emit('auth_ok', { userId: session.user.id });
      } else {
        socket.emit('auth_error', { message: 'invalid token' });
      }
    });

    // Join chat room
    socket.on('join', (chatId: string) => {
      socket.join(chatId);
    });
  });

  return {
    broadcast(chatId: string, event: Record<string, unknown>) {
      io.to(chatId).emit(event.type as string, event);
    },
  };
}
