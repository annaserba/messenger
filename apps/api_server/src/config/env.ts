const port = Number(process.env.PORT ?? 3000);

export type AppConfig = {
  port: number;
  frontendUrl: string;
  yandex: {
    clientId?: string;
    clientSecret?: string;
    redirectUri: string;
  };
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
};
