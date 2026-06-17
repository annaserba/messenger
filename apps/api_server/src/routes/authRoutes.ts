import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AppConfig } from '../config/env.ts';
import type { SessionStore } from '../data/inMemorySessionStore.ts';
import type { UserStore } from '../data/userStore.ts';
import { hashPhone } from '../domain/crypto.ts';
import { sendJson } from '../http/json.ts';

type RouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  config: AppConfig;
  sessionStore: SessionStore;
  userStore: UserStore;
};

type YandexTokenResponse = {
  access_token: string;
};

type YandexProfileResponse = {
  id: string | number;
  display_name?: string;
  real_name?: string;
  first_name?: string;
  last_name?: string;
  default_email?: string;
  default_phone?: { number: string };
  default_avatar_id?: string;
  is_avatar_empty?: boolean;
};

export async function handleAuthRoutes({
  req,
  res,
  url,
  config,
  sessionStore,
  userStore,
}: RouteContext): Promise<boolean> {
  if (req.method === 'GET' && url.pathname === '/api/auth/yandex/url') {
    if (!config.yandex.clientId) {
      sendJson(res, 200, {
        configured: false,
        demoAvailable: true,
        reason: 'YANDEX_CLIENT_ID is not configured',
      });
      return true;
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.yandex.clientId,
      redirect_uri: config.yandex.redirectUri,
      state: randomUUID(),
    });

    sendJson(res, 200, {
      configured: true,
      url: `https://oauth.yandex.ru/authorize?${params.toString()}`,
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/yandex/demo') {
    const phone = '+79001234567';
    const phoneHash = hashPhone(phone);
    const existingId = phoneHash ? userStore.findByPhoneHash(phoneHash)?.id : null;
    const userId = existingId ?? 'demo-yandex-user';

    const session = sessionStore.createSession({
      id: userId,
      name: existingId ? userStore.getById(userId)!.name : 'Анна',
      email: 'anna@example.com',
      firstName: 'Анна',
      lastName: 'Сергеева',
      phone,
      provider: 'yandex-demo',
    });

    userStore.upsert({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      avatarUrl: session.user.avatarUrl,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      phone: session.user.phone,
      provider: session.user.provider,
    });

    if (phoneHash) userStore.linkPhoneHash(session.user.id, phoneHash);

    sendJson(res, 200, {
      user: session.user,
      accessToken: session.accessToken,
      linked: existingId != null,
    });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const token = getBearerToken(req);
    const session = token ? sessionStore.findByToken(token) : null;

    if (!session) {
      sendJson(res, 401, { error: 'unauthorized' });
      return true;
    }

    sendJson(res, 200, { user: session.user });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/yandex/callback') {
    await handleYandexCallback({ res, url, config, sessionStore, userStore });
    return true;
  }

  return false;
}

async function handleYandexCallback({
  res,
  url,
  config,
  sessionStore,
  userStore,
}: Omit<RouteContext, 'req'>): Promise<void> {
  if (!config.yandex.clientId || !config.yandex.clientSecret) {
    redirect(res, `${config.frontendUrl}?auth=not_configured`);
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    redirect(res, `${config.frontendUrl}?auth=missing_code`);
    return;
  }

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.yandex.clientId,
    client_secret: config.yandex.clientSecret,
  });

  const tokenResponse = await fetch('https://oauth.yandex.ru/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody,
  }).catch((err) => {
    console.error('Yandex token fetch failed:', err.message, err.cause);
    return null;
  });

  if (!tokenResponse || !tokenResponse.ok) {
    redirect(res, `${config.frontendUrl}?auth=token_failed`);
    return;
  }

  const token = (await tokenResponse.json()) as YandexTokenResponse;
  const profileResponse = await fetch('https://login.yandex.ru/info?format=json', {
    headers: { Authorization: `OAuth ${token.access_token}` },
  }).catch((err) => {
    console.error('Yandex profile fetch failed:', err.message, err.cause);
    return null;
  });

  if (!profileResponse || !profileResponse.ok) {
    redirect(res, `${config.frontendUrl}?auth=profile_failed`);
    return;
  }

  const profile = (await profileResponse.json()) as YandexProfileResponse;

  const avatarUrl = profile.default_avatar_id && !profile.is_avatar_empty
    ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
    : undefined;

  const name = profile.display_name || profile.real_name || 'Пользователь';
  const phone = profile.default_phone?.number;
  const phoneHash = hashPhone(phone);
  const existingId = phoneHash ? userStore.findByPhoneHash(phoneHash)?.id : null;
  const userId = existingId ?? String(profile.id);

  if (existingId) {
    // Use existing user data
    const existing = userStore.getById(existingId);
    if (existing) {
      const session = sessionStore.createSession({
        id: existingId,
        name: existing.name,
        email: existing.email,
        avatarUrl: existing.avatarUrl || avatarUrl,
        firstName: existing.firstName,
        lastName: existing.lastName,
        phone: existing.phone || phone,
        provider: 'yandex',
      });
      if (phoneHash) userStore.linkPhoneHash(existingId, phoneHash);
      redirect(res, `${config.frontendUrl}?auth=yandex&token=${session.accessToken}&linked=1`);
      return;
    }
  }

  const session = sessionStore.createSession({
    id: userId,
    name,
    email: profile.default_email,
    avatarUrl,
    firstName: profile.first_name,
    lastName: profile.last_name,
    phone: profile.default_phone?.number,
    provider: 'yandex',
  });

  userStore.upsert({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    avatarUrl: session.user.avatarUrl,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    phone: session.user.phone,
    provider: session.user.provider,
  });

  const params = new URLSearchParams({
    auth: 'yandex',
    token: session.accessToken,
  });

  redirect(res, `${config.frontendUrl}?${params.toString()}`);
}

function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { Location: location });
  res.end();
}

function getBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}
