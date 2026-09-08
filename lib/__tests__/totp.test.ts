import { describe, it, expect } from 'vitest';
import { authenticator } from 'otplib';
import { generateTotpSecret, totpKeyUri, verifyTotpToken, generateRecoveryCodes } from '../totp';

describe('generateTotpSecret / totpKeyUri', () => {
  it('generates a base32 secret', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThan(10);
  });

  it('builds an otpauth:// URI containing the issuer and account name', () => {
    const secret = generateTotpSecret();
    const uri = totpKeyUri('user@example.com', secret);
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('UptimeSaaS');
    expect(decodeURIComponent(uri)).toContain('user@example.com');
  });
});

describe('verifyTotpToken', () => {
  it('accepts a token generated for the same secret at the current time', () => {
    const secret = generateTotpSecret();
    const token = authenticator.generate(secret);
    expect(verifyTotpToken(token, secret)).toBe(true);
  });

  it('rejects a token generated for a different secret', () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const tokenForB = authenticator.generate(secretB);
    expect(verifyTotpToken(tokenForB, secretA)).toBe(false);
  });

  it('rejects garbage input without throwing', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpToken('not-a-code', secret)).toBe(false);
  });
});

describe('generateRecoveryCodes', () => {
  it('generates the requested number of unique, correctly-shaped codes', () => {
    const codes = generateRecoveryCodes(8);
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const code of codes) {
      expect(code).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
    }
  });
});

// server.ts, kurtarma kodu karsilastirmasini yalnizca girdi bu bicime uydugunda
// yapiyor (hatali TOTP denemelerinde 8 bcrypt cagrisini onlemek icin). Uretici
// ile oradaki regex birbirinden ayrilirsa kurtarma kodlari sessizce calismaz
// hale gelir; bu test ikisini bagli tutar. — server.ts kurtarma kodu bicimi
describe('recovery code format contract with server.ts', () => {
  const SERVER_RECOVERY_CODE_PATTERN = /^[0-9a-f]{5}-[0-9a-f]{5}$/i;

  it('every generated code matches the pattern the login route accepts', () => {
    for (const code of generateRecoveryCodes(16)) {
      expect(code).toMatch(SERVER_RECOVERY_CODE_PATTERN);
    }
  });

  it('a 6-digit TOTP code never looks like a recovery code', () => {
    expect(SERVER_RECOVERY_CODE_PATTERN.test('123456')).toBe(false);
    expect(SERVER_RECOVERY_CODE_PATTERN.test('000000')).toBe(false);
  });
});
