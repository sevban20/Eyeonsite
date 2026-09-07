import dns from 'dns';
import net from 'net';

/**
 * SSRF guard: returns true when an IP address is private/internal
 * (RFC1918, loopback, link-local, CGNAT) and therefore must not be probed
 * by monitors unless ALLOW_PRIVATE_TARGETS=true.
 *
 * An unparseable address is treated as private (block) rather than public
 * (allow) — fail closed.
 */
export function isPrivateIp(ip: string): boolean {
  let addr = ip.toLowerCase();
  if (addr.startsWith('::ffff:')) addr = addr.slice(7); // IPv4-mapped IPv6
  if (net.isIPv6(addr)) {
    return addr === '::1' || addr === '::' || addr.startsWith('fc') || addr.startsWith('fd') || addr.startsWith('fe80');
  }
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true; // unparseable → block
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168);
}

/**
 * Resolves a monitor target (full URL or bare host/IP) down to a single IP
 * address, for isPrivateIp() to check. Returns null when resolution fails.
 */
export async function resolveTargetIp(target: string): Promise<string | null> {
  let host = target;
  try { host = new URL(target).hostname; } catch { /* bare hostname/IP (TCP & PING monitors) */ }
  host = host.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) return host;
  return new Promise(resolve => dns.lookup(host, (err, address) => resolve(err ? null : address)));
}
