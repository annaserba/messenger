import { randomUUID } from 'node:crypto';

export type ChatType = 'personal' | 'group' | 'channel';

export type ChatParticipant = {
  userId: string;
  name: string;
  role: 'admin' | 'member';
  joinedAt: string;
};

export type Reaction = {
  userId: string;
  name: string;
  emoji: string;
};

export type ReplyInfo = {
  id: string;
  author: string;
  text: string;
};

export type Message = {
  id: string;
  author: string;
  text: string;
  sentAt: string;
  reactions: Reaction[];
  replyTo?: ReplyInfo;
};

export type Chat = {
  id: string;
  title: string;
  subtitle: string;
  avatarLabel: string;
  isOnline: boolean;
  type: ChatType;
  createdBy: string;
  participants: ChatParticipant[];
  messages: Message[];
};

export function createMessage(
  author: string,
  text: string,
  sentAt: number,
  replyTo?: ReplyInfo,
): Message {
  return {
    id: randomUUID(),
    author,
    text,
    sentAt: new Date(sentAt).toISOString(),
    reactions: [],
    ...(replyTo ? { replyTo } : {}),
  };
}

export function toggleReaction(
  message: Message,
  userId: string,
  userName: string,
  emoji: string,
): boolean {
  const existing = message.reactions.findIndex(
    (r) => r.userId === userId && r.emoji === emoji,
  );
  if (existing !== -1) {
    message.reactions.splice(existing, 1);
    return false;
  }
  message.reactions.push({ userId, name: userName, emoji });
  return true;
}

export function aggregatedReactions(reactions: Reaction[]): { emoji: string; count: number; mine: boolean; userId: string }[] {
  const map = new Map<string, { count: number; userIds: Set<string> }>();
  for (const r of reactions) {
    const entry = map.get(r.emoji) ?? { count: 0, userIds: new Set<string>() };
    entry.count++;
    entry.userIds.add(r.userId);
    map.set(r.emoji, entry);
  }
  return [...map.entries()].map(([emoji, v]) => ({
    emoji,
    count: v.count,
    mine: false,
    userId: '',
  }));
}

export function makeParticipant(userId: string, name: string, role: 'admin' | 'member' = 'member'): ChatParticipant {
  return { userId, name, role, joinedAt: new Date().toISOString() };
}

export function canWrite(chat: Chat, userId: string): boolean {
  if (chat.type === 'channel') {
    return chat.participants.some((p) => p.userId === userId && p.role === 'admin');
  }
  return true;
}
