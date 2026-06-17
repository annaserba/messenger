import { createHash } from 'node:crypto';

const SALT = process.env.PHONE_HASH_SALT ?? 'messenger-dev-salt-change-me';

export function hashPhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.length < 10) return null;
  return createHash('sha256').update(cleaned + SALT).digest('hex');
}
