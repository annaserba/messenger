import { randomUUID } from 'node:crypto';

export type AuthUser = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  firstName?: string;
  lastName?: string;
  provider: 'yandex' | 'yandex-demo';
};

export type UserSession = {
  accessToken: string;
  user: AuthUser;
  createdAt: string;
};

export type SessionStore = {
  createSession(user: AuthUser): UserSession;
  findByToken(accessToken: string): UserSession | null;
};

export function createInMemorySessionStore(): SessionStore {
  const sessions = new Map<string, UserSession>();

  return {
    createSession(user: AuthUser) {
      const accessToken = randomUUID();
      const session = {
        accessToken,
        user,
        createdAt: new Date().toISOString(),
      };
      sessions.set(accessToken, session);
      return session;
    },

    findByToken(accessToken: string) {
      return sessions.get(accessToken) ?? null;
    },
  };
}
