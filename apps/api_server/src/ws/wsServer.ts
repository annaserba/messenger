import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server as HttpServer } from 'node:http';
import type { SessionStore } from '../data/redisSessionStore.ts';

const pubClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
const subClient = pubClient.duplicate();

export type WsContext = {
  broadcast(chatId: string, event: Record<string, unknown>): void;
};

export function createWsServer(httpServer: HttpServer, sessionStore: SessionStore): WsContext {
  const io = new SocketIOServer(httpServer, {
    path: '/ws',
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
    adapter: createAdapter(pubClient, subClient),
  });

  io.on('connection', async (socket) => {
    socket.on('auth', async (data: { token: string }) => {
      const session = await sessionStore.findByToken(data.token);
      if (session) {
        socket.data.userId = session.user.id;
        socket.join(session.user.id);
        socket.emit('auth_ok', { userId: session.user.id });
      } else {
        socket.emit('auth_error', { message: 'invalid token' });
      }
    });

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
