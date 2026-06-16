import { randomUUID } from 'node:crypto';

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
  isGroup: boolean;
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
