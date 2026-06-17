export type UserRecord = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  provider: string;
};

export type UserStore = {
  upsert(user: UserRecord): void;
  search(query: string): UserRecord[];
  getById(id: string): UserRecord | undefined;
  findByPhoneHash(hash: string): UserRecord | undefined;
  linkPhoneHash(userId: string, hash: string): void;
};

export function createInMemoryUserStore(): UserStore {
  const users = new Map<string, UserRecord>();
  const phoneHashes = new Map<string, string>(); // hash → userId

  return {
    upsert(user: UserRecord) {
      users.set(user.id, user);
    },
    search(query: string) {
      const q = query.toLowerCase();
      return [...users.values()].filter((u) =>
        u.name.toLowerCase().includes(q) ||
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q)
      );
    },
    getById(id: string) {
      return users.get(id);
    },
    findByPhoneHash(hash: string) {
      const userId = phoneHashes.get(hash);
      if (!userId) return undefined;
      return users.get(userId);
    },
    linkPhoneHash(userId: string, hash: string) {
      const existing = phoneHashes.get(hash);
      if (!existing) {
        phoneHashes.set(hash, userId);
      }
      // If existing user has same hash, they're already linked
      return existing;
    },
  };
}
