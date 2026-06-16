import { randomUUID } from 'node:crypto';

export type ChatType = 'personal' | 'group' | 'channel';

export type ChatParticipant = {
  userId: string;
  name: string;
  role: 'admin' | 'member';
  joinedAt: string;
};

export type Message = {
  id: string;
  author: string;
  text: string;
  sentAt: string;
  reaction: string | null;
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
  reaction: string | null = null,
): Message {
  return {
    id: randomUUID(),
    author,
    text,
    sentAt: new Date(sentAt).toISOString(),
    reaction,
  };
}

export function makeParticipant(userId: string, name: string, role: 'admin' | 'member' = 'member'): ChatParticipant {
  return { userId, name, role, joinedAt: new Date().toISOString() };
}

export function participantCountLabel(chat: Chat): string {
  const count = chat.participants.length;
  if (chat.type === 'channel') return count === 1 ? 'канал' : `${count} подписчиков`;
  if (chat.type === 'group') return `${count} участников`;
  return '';
}

export function canWrite(chat: Chat, userId: string): boolean {
  if (chat.type === 'channel') {
    return chat.participants.some((p) => p.userId === userId && p.role === 'admin');
  }
  return true;
}
