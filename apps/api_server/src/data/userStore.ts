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
};

export function createInMemoryUserStore(): UserStore {
  const users = new Map<string, UserRecord>();

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
  };
}
