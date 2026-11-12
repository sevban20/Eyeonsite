import { describe, it, expect } from 'vitest';
import { isPrivateIp, guardedLookup } from '../security';
import { monitorUpdateSchema, userUpdateSchema, monitorTargetError, statusPageUpdateSchema, adminRoleSchema } from '../validation';

const WS = '11111111-1111-4111-8111-111111111111';

describe('isPrivateIp — extra ranges', () => {
  it.each(['198.18.0.1', '198.19.255.1', '224.0.0.1', '255.255.255.255', '192.0.0.8', '64:ff9b::7f00:1', 'fec0::1', 'ff02::1', '2002:7f00:1::'])(
    'blocks %s', (ip) => expect(isPrivateIp(ip)).toBe(true)
  );
  it.each(['8.8.8.8', '81.27.78.100', '2606:4700::1111'])('allows %s', (ip) => expect(isPrivateIp(ip)).toBe(false));
});

describe('guardedLookup', () => {
  it('refuses a hostname that resolves to loopback', async () => {
    const err: any = await new Promise(resolve => guardedLookup('localhost', {}, (e: any) => resolve(e)));
    expect(err?.code).toBe('EPRIVATE');
  });
  it('handles the all:true form', async () => {
    const err: any = await new Promise(resolve => guardedLookup('localhost', { all: true }, (e: any) => resolve(e)));
    expect(err?.code).toBe('EPRIVATE');
  });
});

describe('monitorUpdateSchema — tenant isolation', () => {
  it('drops workspaceId so a monitor cannot be moved to another workspace', () => {
    const r = monitorUpdateSchema.safeParse({ workspaceId: WS, name: 'x' });
    expect(r.success).toBe(true);
    if (r.success) expect('workspaceId' in r.data).toBe(false);
  });
  it('does not accept a client-written currentStatus', () => {
    const r = monitorUpdateSchema.safeParse({ currentStatus: 'up' });
    expect(r.success && 'currentStatus' in r.data).toBe(false);
  });
  it('rejects an arbitrary status string', () => {
    expect(monitorUpdateSchema.safeParse({ status: 'hacked' }).success).toBe(false);
  });
});

describe('monitorTargetError', () => {
  it('validates the merged record (partial PUT without monitorType)', () => {
    expect(monitorTargetError({ monitorType: 'HTTP', url: 'abc' })).toMatch(/http/);
    expect(monitorTargetError({ monitorType: 'HTTP', url: 'https://ok.example' })).toBeNull();
    expect(monitorTargetError({ monitorType: 'TCP', url: 'http://x/y' })).toMatch(/host/);
    expect(monitorTargetError({ monitorType: 'HEARTBEAT', url: null })).toBeNull();
  });
});

describe('userUpdateSchema — empty form fields', () => {
  it('treats an empty password as "unchanged" instead of failing min(8)', () => {
    const r = userUpdateSchema.safeParse({ name: 'Sevban', email: 'a@b.co', password: '', currentPassword: '' });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.password).toBeUndefined(); expect(r.data.currentPassword).toBeUndefined(); }
  });
  it('lower-cases the email', () => {
    const r = userUpdateSchema.safeParse({ email: 'User@Example.COM' });
    expect(r.success && r.data.email).toBe('user@example.com');
  });
});

describe('status page + admin schemas', () => {
  it('accepts a theme colour on update', () => {
    const r = statusPageUpdateSchema.safeParse({ themeColor: '#22c55e' });
    expect(r.success && r.data.themeColor).toBe('#22c55e');
  });
  it('rejects an unknown admin role', () => {
    expect(adminRoleSchema.safeParse({ role: 'ROOT' }).success).toBe(false);
  });
});
