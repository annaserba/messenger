import webpush from 'web-push';
import type { AppConfig } from '../config/env.ts';

type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushStore = {
  subscribe(userId: string, sub: PushSubscription): void;
  unsubscribe(userId: string): void;
  send(userId: string, payload: Record<string, unknown>): Promise<void>;
  getPublicKey(): string;
};

export function createPushStore(config: AppConfig): PushStore {
  webpush.setVapidDetails(config.email, config.vapid.publicKey, config.vapid.privateKey);

  const subscriptions = new Map<string, PushSubscription>();

  return {
    subscribe(userId: string, sub: PushSubscription) {
      subscriptions.set(userId, sub);
    },

    unsubscribe(userId: string) {
      subscriptions.delete(userId);
    },

    async send(userId: string, payload: Record<string, unknown>) {
      const sub = subscriptions.get(userId);
      if (!sub) return;
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
      } catch (err: unknown) {
        if ((err as { statusCode?: number })?.statusCode === 410) {
          subscriptions.delete(userId);
        }
      }
    },

    getPublicKey() {
      return config.vapid.publicKey;
    },
  };
}
