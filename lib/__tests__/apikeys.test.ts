import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, looksLikeApiKey } from '../apikeys';

describe('generateApiKey', () => {
  it('produces a raw key whose hash matches the stored hash', () => {
    const { rawKey, hash } = generateApiKey();
    expect(hashApiKey(rawKey)).toBe(hash);
  });

  it('never generates the same key twice', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.rawKey).not.toBe(b.rawKey);
    expect(a.hash).not.toBe(b.hash);
  });

  it('produces a preview that does not leak the full secret', () => {
    const { rawKey, preview } = generateApiKey();
    expect(preview).not.toBe(rawKey);
    expect(preview).toContain('…');
    expect(rawKey).toContain(preview.split('…')[0]);
  });

  it('prefixes raw keys so they are recognizable', () => {
    const { rawKey } = generateApiKey();
    expect(rawKey.startsWith('umk_')).toBe(true);
  });
});

describe('looksLikeApiKey', () => {
  it('recognizes a generated key', () => {
    const { rawKey } = generateApiKey();
    expect(looksLikeApiKey(rawKey)).toBe(true);
  });

  it('rejects a JWT-shaped or empty value', () => {
    expect(looksLikeApiKey('eyJhbGciOiJIUzI1NiJ9.abc.def')).toBe(false);
    expect(looksLikeApiKey('')).toBe(false);
    expect(looksLikeApiKey(undefined)).toBe(false);
    expect(looksLikeApiKey(null)).toBe(false);
  });
});
