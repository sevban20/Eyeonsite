import { describe, it, expect } from 'vitest';
import { isPrivateIp, resolveTargetIp } from '../security';

describe('isPrivateIp', () => {
  it('blocks loopback', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
  });

  it('blocks RFC1918 private ranges', () => {
    expect(isPrivateIp('10.0.0.5')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
  });

  it('does not block adjacent-but-public ranges around 172.16/12', () => {
    expect(isPrivateIp('172.15.255.255')).toBe(false);
    expect(isPrivateIp('172.32.0.1')).toBe(false);
  });

  it('blocks link-local and CGNAT', () => {
    expect(isPrivateIp('169.254.1.1')).toBe(true);
    expect(isPrivateIp('100.64.0.1')).toBe(true);
    expect(isPrivateIp('100.127.255.255')).toBe(true);
  });

  it('does not block CGNAT-adjacent public range', () => {
    expect(isPrivateIp('100.128.0.1')).toBe(false);
  });

  it('allows well-known public IPs', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
  });

  it('blocks IPv6 loopback and unique-local/link-local', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('fd12:3456::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
  });

  it('unwraps IPv4-mapped IPv6 addresses before checking', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
  });

  it('fails closed (blocks) on unparseable input', () => {
    expect(isPrivateIp('not-an-ip')).toBe(true);
    expect(isPrivateIp('')).toBe(true);
  });
});

describe('resolveTargetIp', () => {
  it('returns a bare IPv4 target immediately without DNS lookup', async () => {
    await expect(resolveTargetIp('192.168.1.1')).resolves.toBe('192.168.1.1');
  });

  it('extracts and returns the IP from a URL whose host is already an IP', async () => {
    await expect(resolveTargetIp('http://127.0.0.1:8080/health')).resolves.toBe('127.0.0.1');
  });

  it('strips brackets from a bracketed IPv6 URL host', async () => {
    await expect(resolveTargetIp('http://[::1]:8080/')).resolves.toBe('::1');
  });
});
