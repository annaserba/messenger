const port = Number(process.env.PORT ?? 3000);

export type AppConfig = {
  port: number;
  frontendUrl: string;
  yandex: {
    clientId?: string;
    clientSecret?: string;
    redirectUri: string;
  };
  vapid: {
    publicKey: string;
    privateKey: string;
  };
  email: string;
};

export const config: AppConfig = {
  port,
  frontendUrl: process.env.FRONTEND_URL ?? 'http://127.0.0.1:8080',
  yandex: {
    clientId: process.env.YANDEX_CLIENT_ID,
    clientSecret: process.env.YANDEX_CLIENT_SECRET,
    redirectUri:
      process.env.YANDEX_REDIRECT_URI ??
      `http://127.0.0.1:${port}/api/auth/yandex/callback`,
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC ?? 'BIYlwyN9j3dkuxT7MgHrCbF9uEJmRYzpJ2AOvHzVTf4poXUK45IqHz3vWIxkOTKqd0Zmc1yGEaxCbj5DjTCicNs',
    privateKey: process.env.VAPID_PRIVATE ?? 'CF2zqmYuJfx4spFwtTlRdnHqT5uEOnQjclj7dB7vRiA',
  },
  email: process.env.VAPID_EMAIL ?? 'mailto:push@messenger.local',
};
