import type { PushStore } from './pushStore.ts';

export type ChatEvent = {
  type: 'message_created';
  chatId: string;
  messageId: string;
  authorName: string;
  text: string;
  chatTitle: string;
  chatType: string;
  recipientUserIds: string[];
};

let _pubClient: ReturnType<typeof import('ioredis').default> | null = null;
let _subClient: ReturnType<typeof import('ioredis').default> | null = null;

async function getPub() {
  if (!_pubClient) {
    const Redis = (await import('ioredis')).default;
    _pubClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
    await _pubClient.connect();
  }
  return _pubClient;
}

export async function publishEvent(channel: string, event: ChatEvent) {
  try {
    const pub = await getPub();
    await pub.publish(channel, JSON.stringify(event));
  } catch {
    // Redis unavailable — events are best-effort
  }
}

export async function subscribeToEvents(
  channel: string,
  handler: (event: ChatEvent) => Promise<void>,
) {
  try {
    const Redis = (await import('ioredis')).default;
    _subClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
    await _subClient.connect();
    await _subClient.subscribe(channel);
    _subClient.on('message', (_ch, message) => {
      try {
        const event = JSON.parse(message) as ChatEvent;
        handler(event).catch(() => {});
      } catch {}
    });
    console.log(`EventBus: subscribed to ${channel}`);
  } catch {
    console.log('EventBus: Redis unavailable, events disabled');
  }
}
