import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';

const ISSUER = 'UptimeSaaS';

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpKeyUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function totpQrCodeDataUrl(email: string, secret: string): Promise<string> {
  return QRCode.toDataURL(totpKeyUri(email, secret));
}

export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Generates a set of one-time recovery codes (shown once at 2FA setup).
 * Callers store only the bcrypt hash of each code.
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // 5 random bytes → 10 hex chars, formatted as XXXXX-XXXXX for readability
    const hex = randomBytes(5).toString('hex');
    codes.push(`${hex.slice(0, 5)}-${hex.slice(5, 10)}`);
  }
  return codes;
}
