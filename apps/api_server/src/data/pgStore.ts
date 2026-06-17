import { randomUUID } from 'node:crypto';
import { hashPhone } from '../domain/crypto.ts';
import type { ChatType, Message, Reaction } from '../domain/message.ts';

type ChatRow = {
  id: string;
  title: string;
  type: ChatType;
  created_by: string;
  avatar_label: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  chat_id: string;
  author_phone: string;
  author_name: string;
  text: string;
  sent_at: string;
  reply_to_id: string | null;
  reply_to_author: string | null;
  reply_to_text: string | null;
  edited: boolean;
  deleted: boolean;
};

type ReactionRow = {
  message_id: string;
  user_phone: string;
  user_name: string;
  emoji: string;
};

export type PublicChat = {
  id: string;
  title: string;
  subtitle: string;
  avatarLabel: string;
  isOnline: boolean;
  type: ChatType;
  participants: { userId: string; name: string; role: string; joinedAt: string }[];
  messages: Message[];
  lastMessage?: Message;
};

export type ChatStore = {
  init(): Promise<void>;
  listChats(userId: string): Promise<PublicChat[]>;
  findChat(chatId: string): Promise<ChatRow | undefined>;
  addMessage(chatId: string, authorPhone: string, authorName: string, text: string, replyToId?: string): Promise<Message | null>;
  editMessage(messageId: string, text: string): Promise<Message | null>;
  deleteMessage(messageId: string): Promise<boolean>;
  setReaction(messageId: string, userPhone: string, userName: string, emoji: string): Promise<Message | null>;
  createChat(title: string, type: ChatType, createdBy: string, creatorName: string): Promise<ChatRow>;
  joinChat(chatId: string, userId: string, name: string): Promise<ChatRow | null>;
  ensureUserChats(userId: string, name: string): Promise<void>;
};

let _pool: import('pg').Pool | null = null;

async function getPool() {
  if (!_pool) {
    const pg = await import('pg');
    _pool = new pg.default.Pool({
      connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/messenger',
    });
  }
  return _pool;
}

async function query(text: string, params?: unknown[]) {
  const pool = await getPool();
  return pool.query(text, params);
}

export function createPgStore(): ChatStore {
  async function init() {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        phone_hash TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('personal','group','channel')),
        created_by TEXT REFERENCES users(phone_hash),
        avatar_label TEXT NOT NULL DEFAULT '?',
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS chat_participants (
        chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
        user_phone TEXT REFERENCES users(phone_hash),
        name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
        joined_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (chat_id, user_phone)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
        author_phone TEXT NOT NULL,
        author_name TEXT NOT NULL,
        text TEXT NOT NULL,
        sent_at TIMESTAMPTZ DEFAULT now(),
        reply_to_id TEXT,
        reply_to_author TEXT,
        reply_to_text TEXT,
        edited BOOLEAN DEFAULT false,
        deleted BOOLEAN DEFAULT false
      );
      CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, sent_at);

      CREATE TABLE IF NOT EXISTS reactions (
        message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
        user_phone TEXT REFERENCES users(phone_hash),
        user_name TEXT NOT NULL,
        emoji TEXT NOT NULL,
        PRIMARY KEY (message_id, user_phone, emoji)
      );
    `);
  }

  async function ensureUserChats(userId: string, name: string) {
    await query('INSERT INTO users (phone_hash) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
    const existing = await query('SELECT id FROM chats WHERE id = $1', [userId]);
    if (existing.rows.length === 0) {
      await query('INSERT INTO chats (id, title, type, created_by, avatar_label) VALUES ($1,$2,$3,$4,$5)',
        [userId, name, 'personal', userId, name.substring(0, 1).toUpperCase()]);
      await query('INSERT INTO chat_participants (chat_id, user_phone, name, role) VALUES ($1,$2,$3,$4)',
        [userId, userId, name, 'admin']);
    }
  }

  async function rowsToMessages(rows: MessageRow[]): Promise<Message[]> {
    const result: Message[] = [];
    for (const row of rows) {
      const r = await query('SELECT * FROM reactions WHERE message_id = $1', [row.id]);
      const reactions: Reaction[] = r.rows.map((rr: ReactionRow) => ({
        userId: rr.user_phone,
        name: rr.user_name,
        emoji: rr.emoji,
      }));
      result.push({
        id: row.id,
        author: row.author_name,
        text: row.text,
        sentAt: row.sent_at,
        reactions,
        ...(row.reply_to_id ? { replyTo: { id: row.reply_to_id, author: row.reply_to_author ?? '', text: row.reply_to_text ?? '' } } : {}),
      } as Message);
    }
    return result;
  }

  async function chatToPublic(chat: ChatRow): Promise<PublicChat> {
    const p = await query('SELECT user_phone, name, role, joined_at FROM chat_participants WHERE chat_id = $1', [chat.id]);
    const participants = p.rows.map((r: { user_phone: string; name: string; role: string; joined_at: string }) => ({
      userId: r.user_phone, name: r.name, role: r.role, joinedAt: r.joined_at,
    }));
    const m = await query("SELECT * FROM messages WHERE chat_id = $1 AND deleted = false ORDER BY sent_at", [chat.id]);
    const messages = await rowsToMessages(m.rows as MessageRow[]);
    return {
      id: chat.id, title: chat.title,
      subtitle: chat.type === 'channel' ? 'канал' : chat.type === 'group' ? 'группа' : '',
      avatarLabel: chat.avatar_label, isOnline: false, type: chat.type,
      participants, messages, lastMessage: messages.at(-1),
    };
  }

  return {
    init,
    async listChats(userId: string) {
      const r = await query(
        `SELECT DISTINCT c.* FROM chats c
         JOIN chat_participants cp ON cp.chat_id = c.id
         WHERE cp.user_phone = $1`, [userId]);
      const result: PublicChat[] = [];
      for (const row of r.rows as ChatRow[]) result.push(await chatToPublic(row));
      return result;
    },
    async findChat(chatId: string) {
      return (await query('SELECT * FROM chats WHERE id = $1', [chatId])).rows[0] as ChatRow | undefined;
    },
    async addMessage(chatId: string, authorPhone: string, authorName: string, text: string, replyToId?: string) {
      const id = randomUUID();
      let replyToAuthor = null, replyToText = null;
      if (replyToId) {
        const r = await query('SELECT author_name, text FROM messages WHERE id = $1', [replyToId]);
        if (r.rows.length > 0) { replyToAuthor = r.rows[0].author_name; replyToText = r.rows[0].text; }
      }
      await query(
        'INSERT INTO messages (id, chat_id, author_phone, author_name, text, reply_to_id, reply_to_author, reply_to_text) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [id, chatId, authorPhone, authorName, text, replyToId ?? null, replyToAuthor, replyToText]);
      return (await query('SELECT * FROM messages WHERE id = $1', [id])).rows[0] as unknown as Message;
    },
    async editMessage(messageId: string, text: string) {
      await query('UPDATE messages SET text = $1, edited = true WHERE id = $2', [text, messageId]);
      return (await query('SELECT * FROM messages WHERE id = $1', [messageId])).rows[0] as unknown as Message;
    },
    async deleteMessage(messageId: string) {
      return ((await query('UPDATE messages SET deleted = true WHERE id = $1', [messageId])).rowCount ?? 0) > 0;
    },
    async setReaction(messageId: string, userPhone: string, userName: string, emoji: string) {
      const exists = await query('SELECT * FROM reactions WHERE message_id=$1 AND user_phone=$2 AND emoji=$3', [messageId, userPhone, emoji]);
      if (exists.rows.length > 0) {
        await query('DELETE FROM reactions WHERE message_id=$1 AND user_phone=$2 AND emoji=$3', [messageId, userPhone, emoji]);
      } else {
        await query('INSERT INTO reactions (message_id, user_phone, user_name, emoji) VALUES ($1,$2,$3,$4)', [messageId, userPhone, userName, emoji]);
      }
      return (await query('SELECT * FROM messages WHERE id = $1', [messageId])).rows[0] as unknown as Message;
    },
    async createChat(title: string, type: ChatType, createdBy: string, creatorName: string) {
      const id = randomUUID();
      await query('INSERT INTO users (phone_hash) VALUES ($1) ON CONFLICT DO NOTHING', [createdBy]);
      await query('INSERT INTO chats (id, title, type, created_by, avatar_label) VALUES ($1,$2,$3,$4,$5)', [id, title, type, createdBy, title.substring(0, 1).toUpperCase()]);
      await query('INSERT INTO chat_participants (chat_id, user_phone, name, role) VALUES ($1,$2,$3,$4)', [id, createdBy, creatorName, 'admin']);
      return (await query('SELECT * FROM chats WHERE id = $1', [id])).rows[0] as ChatRow;
    },
    async joinChat(chatId: string, userId: string, name: string) {
      await query('INSERT INTO users (phone_hash) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
      await query('INSERT INTO chat_participants (chat_id, user_phone, name, role) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [chatId, userId, name, 'member']);
      return (await query('SELECT * FROM chats WHERE id = $1', [chatId])).rows[0] as ChatRow | null;
    },
    ensureUserChats,
  };
}
