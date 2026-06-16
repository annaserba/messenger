import { createMessage, makeParticipant, toggleReaction, type Chat, type ChatType, type Message, type ReplyInfo } from '../domain/message.ts';

export type PublicChat = {
  id: string;
  title: string;
  subtitle: string;
  avatarLabel: string;
  isOnline: boolean;
  type: ChatType;
  participants: Chat['participants'];
  messages: Message[];
  lastMessage?: Message;
};

export type ChatStore = {
  listChats(userId: string): PublicChat[];
  findChat(chatId: string): Chat | undefined;
  findChatByMessage(messageId: string): Chat | undefined;
  findMessage(messageId: string): { chat: Chat; message: Message } | undefined;
  addMessage(chatId: string, author: string, text: string, replyToId?: string): Message | null;
  editMessage(messageId: string, text: string): Message | null;
  deleteMessage(messageId: string): boolean;
  setReaction(messageId: string, userId: string, userName: string, reaction: string): Message | null;
  createChat(title: string, type: ChatType, createdBy: string, creatorName: string): Chat;
  joinChat(chatId: string, userId: string, name: string): Chat | null;
  ensureUserChats(userId: string, name: string): void;
};

export function createInMemoryStore(): ChatStore {
  const chats = new Map<string, Chat>();

  function makeChat(
    id: string,
    title: string,
    type: ChatType,
    createdBy: string,
    creatorName: string,
    extraParticipants: { userId: string; name: string }[] = [],
  ): Chat {
    const participants = [makeParticipant(createdBy, creatorName, 'admin')];
    for (const p of extraParticipants) {
      participants.push(makeParticipant(p.userId, p.name));
    }
    const chat: Chat = {
      id,
      title,
      subtitle: type === 'channel' ? 'канал' : type === 'group' ? 'группа' : '',
      avatarLabel: title.substring(0, 1).toUpperCase(),
      isOnline: false,
      type,
      createdBy,
      participants,
      messages: [],
    };
    chats.set(id, chat);
    return chat;
  }

  function ensureUserChats(userId: string, name: string) {
    if (!chats.has(userId)) {
      makeChat(userId, name, 'personal', userId, name);
    }
  }

  return {
    listChats(userId: string) {
      const result: PublicChat[] = [];
      for (const chat of chats.values()) {
        const isMember = chat.participants.some((p) => p.userId === userId);
        if (isMember) {
          result.push({
            ...chat,
            subtitle: chat.type === 'personal' ? '' : chat.subtitle,
            lastMessage: chat.messages.at(-1),
          });
        }
      }
      return result;
    },

    findChat(chatId: string) {
      return chats.get(chatId);
    },

    findChatByMessage(messageId: string) {
      for (const chat of chats.values()) {
        if (chat.messages.some((m) => m.id === messageId)) return chat;
      }
      return undefined;
    },

    findMessage(messageId: string) {
      for (const chat of chats.values()) {
        const msg = chat.messages.find((m) => m.id === messageId);
        if (msg) return { chat, message: msg };
      }
      return undefined;
    },

    addMessage(chatId: string, author: string, text: string, replyToId?: string) {
      const chat = chats.get(chatId);
      if (!chat) return null;
      let replyTo: ReplyInfo | undefined;
      if (replyToId) {
        const found = this.findMessage(replyToId);
        if (found) {
          replyTo = { id: replyToId, author: found.message.author, text: found.message.text };
        }
      }
      const message = createMessage(author, text, Date.now(), replyTo);
      chat.messages.push(message);
      return message;
    },

    editMessage(messageId: string, text: string) {
      for (const chat of chats.values()) {
        const msg = chat.messages.find((m) => m.id === messageId);
        if (msg) {
          msg.text = text;
          return msg;
        }
      }
      return null;
    },

    deleteMessage(messageId: string) {
      for (const chat of chats.values()) {
        const idx = chat.messages.findIndex((m) => m.id === messageId);
        if (idx !== -1) {
          chat.messages.splice(idx, 1);
          return true;
        }
      }
      return false;
    },

    setReaction(messageId: string, userId: string, userName: string, reaction: string) {
      for (const chat of chats.values()) {
        const target = chat.messages.find((m) => m.id === messageId);
        if (target) {
          toggleReaction(target, userId, userName, reaction);
          return target;
        }
      }
      return null;
    },

    createChat(title: string, type: ChatType, createdBy: string, creatorName: string) {
      const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return makeChat(id, title, type, createdBy, creatorName);
    },

    joinChat(chatId: string, userId: string, name: string) {
      const chat = chats.get(chatId);
      if (!chat) return null;
      if (chat.participants.some((p) => p.userId === userId)) return chat;
      chat.participants.push(makeParticipant(userId, name));
      return chat;
    },

    ensureUserChats,
  };
}
