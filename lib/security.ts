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
    return addr === '::1' || addr === '::' || addr.startsWith('fc') || addr.startsWith('fd') ||
      addr.startsWith('fe8') || addr.startsWith('fe9') || addr.startsWith('fea') || addr.startsWith('feb') || // fe80::/10 link-local
      addr.startsWith('fec') || addr.startsWith('fed') || addr.startsWith('fee') || addr.startsWith('fef') || // fec0::/10 site-local
      addr.startsWith('ff') ||        // multicast
      addr.startsWith('64:ff9b:') ||  // NAT64: IPv4 adresini IPv6 icine gomup korumayi asmanin yolu
      addr.startsWith('2002:');       // 6to4: ayni sekilde gomulu IPv4
  }
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true; // unparseable → block
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && parts[2] === 0) ||  // 192.0.0.0/24 IETF
    (a === 198 && (b === 18 || b === 19)) ||     // 198.18.0.0/15 benchmark
    a >= 224;                                    // multicast + reserved + broadcast
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

/**
 * SSRF guard applied at CONNECT time. Passed as `lookup` to http/https agents,
 * tls.connect and net.connect, it re-checks every address the socket is about
 * to use — so HTTP redirects to an internal host and DNS rebinding (a public
 * answer at check time, a private one at connect time) are both refused, not
 * just the first hop that resolveTargetIp() inspected.
 */
export function guardedLookup(hostname: string, options: any, callback: any) {
  if (typeof options === 'function') { callback = options; options = {}; }
  dns.lookup(hostname, options, (err: any, address: any, family?: number) => {
    if (err) return callback(err);
    const list: { address: string; family: number }[] = Array.isArray(address)
      ? address
      : [{ address, family: family as number }];
    const blocked = list.find(a => isPrivateIp(a.address));
    if (blocked) {
      const e: any = new Error(`Blocked: ${hostname} resolves to a private/internal address (${blocked.address})`);
      e.code = 'EPRIVATE';
      return callback(e);
    }
    if (Array.isArray(address)) callback(null, list);
    else callback(null, address, family);
  });
}
