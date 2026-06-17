import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

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

const TTL = 7 * 24 * 3600; // 7 days

export function createRedisSessionStore(): SessionStore {
  return {
    async createSession(user: AuthUser) {
      const accessToken = randomUUID();
      const session: UserSession = {
        accessToken,
        user,
        createdAt: new Date().toISOString(),
      };
      await redis.setex(`session:${accessToken}`, TTL, JSON.stringify(session));
      return session;
    },

    async findByToken(accessToken: string) {
      const raw = await redis.get(`session:${accessToken}`);
      if (!raw) return null;
      return JSON.parse(raw) as UserSession;
    },
  };
}
