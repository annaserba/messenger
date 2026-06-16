import { createMessage, type Chat, type Message } from '../domain/message.ts';

export type PublicChat = Chat;

export type ChatStore = {
  listChats(): PublicChat[];
  findChat(chatId: string): Chat | undefined;
  addMessage(chatId: string, author: string, text: string): Message | null;
  setReaction(messageId: string, reaction: string): Message | null;
};

export function createInMemoryStore(): ChatStore {
  const now = Date.now();
  const chats: Chat[] = [
    {
      id: 'family',
      title: 'Семья',
      subtitle: 'Групповой чат',
      avatarLabel: 'С',
      isOnline: false,
      isGroup: true,
      messages: [
        createMessage('Мама', 'Кто сегодня сможет зайти за продуктами?', now - 34 * 60_000),
        createMessage('Анна', 'Я смогу после работы. Напишите список.', now - 28 * 60_000, '👍'),
        createMessage('Папа', 'Добавил молоко, хлеб и фрукты.', now - 12 * 60_000),
      ],
    },
    {
      id: 'misha',
      title: 'Миша',
      subtitle: 'онлайн',
      avatarLabel: 'М',
      isOnline: true,
      isGroup: false,
      messages: [
        createMessage('Миша', 'Привет! Созвонимся вечером?', now - 68 * 60_000),
        createMessage('Анна', 'Да, давай после 20:00.', now - 60 * 60_000),
      ],
    },
  ];

  return {
    listChats() {
      return chats.map(publicChat);
    },

    findChat(chatId: string) {
      return chats.find((chat) => chat.id === chatId);
    },

    addMessage(chatId: string, author: string, text: string) {
      const chat = this.findChat(chatId);
      if (!chat) return null;

      const message = createMessage(author, text, Date.now());
      chat.messages.push(message);
      return message;
    },

    setReaction(messageId: string, reaction: string) {
      const target = chats
        .flatMap((chat) => chat.messages)
        .find((message) => message.id === messageId);

      if (!target) return null;
      target.reaction = target.reaction === reaction ? null : reaction;
      return target;
    },
  };
}

function publicChat(chat: Chat): PublicChat {
  return {
    id: chat.id,
    title: chat.title,
    subtitle: chat.subtitle,
    avatarLabel: chat.avatarLabel,
    isOnline: chat.isOnline,
    isGroup: chat.isGroup,
    messages: chat.messages,
  };
}
