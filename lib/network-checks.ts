import tls from 'tls';
import dns from 'dns';
import net from 'net';

// --- SSL CHECK FUNCTION ---
export async function checkSSL(url: string): Promise<{
  valid: boolean;
  expiry: Date | null;
  issuer: string | null;
  subject: string | null;
  daysLeft: number | null;
}> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        return resolve({ valid: false, expiry: null, issuer: null, subject: null, daysLeft: null });
      }
      const port = parseInt(parsed.port) || 443;
      const hostname = parsed.hostname;
      const socket = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: false }, () => {
        try {
          const cert = socket.getPeerCertificate(true);
          socket.end();
          if (!cert || !cert.valid_to) {
            return resolve({ valid: false, expiry: null, issuer: null, subject: null, daysLeft: null });
          }
          const expiry = new Date(cert.valid_to);
          const now = new Date();
          const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const rawIssuer = cert.issuer ? (cert.issuer.O || cert.issuer.CN || null) : null;
          const issuer = rawIssuer ? (Array.isArray(rawIssuer) ? rawIssuer[0] : rawIssuer) : null;
          const rawSubject = cert.subject ? (cert.subject.CN || null) : null;
          const subject = rawSubject ? (Array.isArray(rawSubject) ? rawSubject[0] : rawSubject) : null;
          const valid = socket.authorized || daysLeft > 0;
          resolve({ valid, expiry, issuer: issuer as string | null, subject: subject as string | null, daysLeft });
        } catch {
          socket.end();
          resolve({ valid: false, expiry: null, issuer: null, subject: null, daysLeft: null });
        }
      });
      socket.on('error', () => resolve({ valid: false, expiry: null, issuer: null, subject: null, daysLeft: null }));
      socket.setTimeout(8000, () => { socket.destroy(); resolve({ valid: false, expiry: null, issuer: null, subject: null, daysLeft: null }); });
    } catch {
      resolve({ valid: false, expiry: null, issuer: null, subject: null, daysLeft: null });
    }
  });
}

// --- DNS CHECK FUNCTION ---
export async function checkDNS(url: string): Promise<{ resolvedIp: string | null; resolutionTime: number }> {
  return new Promise((resolve) => {
    try {
      const hostname = new URL(url).hostname;
      const start = Date.now();
      dns.lookup(hostname, (err, address) => {
        const resolutionTime = Date.now() - start;
        if (err) return resolve({ resolvedIp: null, resolutionTime });
        resolve({ resolvedIp: address, resolutionTime });
      });
    } catch {
      resolve({ resolvedIp: null, resolutionTime: 0 });
    }
  });
}

// --- TCP CHECK FUNCTION ---
export async function checkTCP(host: string, port: number, timeoutMs = 10000): Promise<{ responseTime: number }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      const responseTime = Date.now() - start;
      socket.destroy();
      resolve({ responseTime });
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`TCP timeout after ${timeoutMs}ms`));
    });
    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });
    socket.connect(port, host);
  });
}
