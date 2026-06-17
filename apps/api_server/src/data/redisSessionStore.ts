import { randomUUID } from 'node:crypto';

export type AuthUser = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  provider: 'yandex' | 'yandex-demo';
};

export type UserSession = {
  accessToken: string;
  user: AuthUser;
  createdAt: string;
};

export type SessionStore = {
  createSession(user: AuthUser): Promise<UserSession>;
  findByToken(accessToken: string): Promise<UserSession | null>;
};

const TTL = 7 * 24 * 3600;

let _redis: import('ioredis').default | null = null;

async function getRedis() {
  if (!_redis) {
    const Redis = (await import('ioredis')).default;
    _redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    await _redis.connect();
  }
  return _redis;
}

export function createRedisSessionStore(): SessionStore {
  return {
    async createSession(user: AuthUser) {
      const redis = await getRedis();
      const accessToken = randomUUID();
      const session: UserSession = { accessToken, user, createdAt: new Date().toISOString() };
      await redis.setex(`session:${accessToken}`, TTL, JSON.stringify(session));
      return session;
    },
    async findByToken(accessToken: string) {
      try {
        const redis = await getRedis();
        const raw = await redis.get(`session:${accessToken}`);
        if (!raw) return null;
        return JSON.parse(raw) as UserSession;
      } catch {
        return null;
      }
    },
  };
}
