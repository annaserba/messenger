import { createMessage, type Chat, type Message } from '../domain/message.ts';

export type PublicChat = Omit<Chat, 'messages'> & { messages: Message[]; lastMessage?: Message };

export type ChatStore = {
  listChats(userId: string): PublicChat[];
  findChat(chatId: string): Chat | undefined;
  findChatByMessage(messageId: string): Chat | undefined;
  addMessage(chatId: string, author: string, text: string): Message | null;
  setReaction(messageId: string, reaction: string): Message | null;
  ensureUserChats(userId: string, name: string): void;
};

export function createInMemoryStore(): ChatStore {
  const chats = new Map<string, Chat>();

  function makeChat(id: string, title: string, isGroup: boolean, members: string[]): Chat {
    const chat: Chat = {
      id,
      title,
      subtitle: isGroup ? 'Групповой чат' : '',
      avatarLabel: title.substring(0, 1).toUpperCase(),
      isOnline: false,
      isGroup,
      messages: [],
    };
    chats.set(id, chat);
    return chat;
  }

  function ensureUserChats(userId: string, name: string) {
    if (!chats.has(userId)) {
      const chat = makeChat(userId, name, false, [userId]);
      chat.subtitle = 'онлайн';
      chat.isOnline = true;
      chat.messages.push(
        createMessage(name, 'Привет! Это ваш личный чат.', Date.now() - 60_000),
      );
    }
  }

  return {
    listChats(userId: string) {
      const result: PublicChat[] = [];
      for (const chat of chats.values()) {
        if (chat.id === userId) {
          result.push({ ...chat, lastMessage: chat.messages.at(-1) });
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

    addMessage(chatId: string, author: string, text: string) {
      const chat = chats.get(chatId);
      if (!chat) return null;
      const message = createMessage(author, text, Date.now());
      chat.messages.push(message);
      return message;
    },

    setReaction(messageId: string, reaction: string) {
      for (const chat of chats.values()) {
        const target = chat.messages.find((m) => m.id === messageId);
        if (target) {
          target.reaction = target.reaction === reaction ? null : reaction;
          return target;
        }
      }
      return null;
    },

    ensureUserChats,
  };
}
