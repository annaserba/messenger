import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { SessionStore } from '../data/redisSessionStore.ts';

export type WsContext = {
  broadcast(chatId: string, event: Record<string, unknown>): void;
};

let redisAdapter: ReturnType<typeof import('@socket.io/redis-adapter').createAdapter> | undefined;

async function tryRedisAdapter() {
  try {
    const Redis = (await import('ioredis')).default;
    const { createAdapter } = await import('@socket.io/redis-adapter');
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const pub = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    redisAdapter = createAdapter(pub, sub);
    console.log('WS: Redis adapter enabled');
  } catch {
    console.log('WS: in-memory adapter (Redis unavailable)');
  }
}

export function createWsServer(httpServer: HttpServer, sessionStore: SessionStore): WsContext {
  const opts: Parameters<typeof SocketIOServer>[1] = {
    path: '/ws',
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  };
  if (redisAdapter) opts.adapter = redisAdapter;

  const io = new SocketIOServer(httpServer, opts);

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
    socket.on('join', (chatId: string) => socket.join(chatId));
  });

  return {
    broadcast(chatId: string, event: Record<string, unknown>) {
      io.to(chatId).emit(event.type as string, event);
    },
  };
}

// Init Redis adapter (non-blocking)
tryRedisAdapter();
