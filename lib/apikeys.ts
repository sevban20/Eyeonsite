import { randomBytes, createHash } from 'crypto';

const API_KEY_PREFIX = 'umk_'; // "uptime monitor key"

/**
 * Generates a new API key. The raw key is shown to the user exactly once;
 * only its SHA-256 hash is persisted, so a stolen database dump alone
 * cannot be used to authenticate as the key.
 */
export function generateApiKey(): { rawKey: string; hash: string; preview: string } {
  const secret = randomBytes(32).toString('hex');
  const rawKey = `${API_KEY_PREFIX}${secret}`;
  const hash = hashApiKey(rawKey);
  const preview = `${API_KEY_PREFIX}${secret.slice(0, 4)}…${secret.slice(-4)}`;
  return { rawKey, hash, preview };
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function looksLikeApiKey(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.startsWith(API_KEY_PREFIX) && value.length > API_KEY_PREFIX.length + 16;
}
