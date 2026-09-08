import { describe, it, expect } from 'vitest';
import { monitorGroupCreateSchema, monitorGroupUpdateSchema } from '../validation';

const WS = '11111111-1111-4111-8111-111111111111';

describe('monitorGroup schemas (Faz 3.5)', () => {
  it('creates a plain group without composite fields', () => {
    const r = monitorGroupCreateSchema.safeParse({ name: 'Ankara', workspaceId: WS });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.color).toBe('#f97316');
      expect('degradedChannels' in r.data).toBe(false);
      expect('compositeEnabled' in r.data).toBe(false);
    }
  });

  it('serialises channel objects into a JSON string for the DB column', () => {
    const r = monitorGroupUpdateSchema.safeParse({
      compositeEnabled: true,
      downChannels: { alertEmail: 'noc@example.com', slackWebhook: 'https://hooks.slack.com/x' }
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(typeof r.data.downChannels).toBe('string');
      expect(JSON.parse(r.data.downChannels as string)).toEqual({
        alertEmail: 'noc@example.com',
        slackWebhook: 'https://hooks.slack.com/x'
      });
    }
  });

  // En kritik regresyon: grup adini degistiren kismi PUT, composite
  // ayarlarini varsayilana dondurmemeli (zod v4 partial+default tuzagi).
  it('does not resurrect composite defaults on a partial update', () => {
    const r = monitorGroupUpdateSchema.safeParse({ name: 'Yeni ad' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(Object.keys(r.data)).toEqual(['name']);
    }
  });

  it('accepts null to clear a channel set', () => {
    const r = monitorGroupUpdateSchema.safeParse({ downChannels: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.downChannels).toBeNull();
  });

  it('rejects malformed channel values and unknown keys', () => {
    expect(monitorGroupUpdateSchema.safeParse({ downChannels: { alertEmail: 'not-an-email' } }).success).toBe(false);
    expect(monitorGroupUpdateSchema.safeParse({ downChannels: { slackWebhook: 'not-a-url' } }).success).toBe(false);
    expect(monitorGroupUpdateSchema.safeParse({ downChannels: { nope: 'x' } }).success).toBe(false);
  });

  it('bounds the degraded threshold', () => {
    expect(monitorGroupUpdateSchema.safeParse({ degradedThreshold: 1 }).success).toBe(true);
    expect(monitorGroupUpdateSchema.safeParse({ degradedThreshold: 0 }).success).toBe(false);
    expect(monitorGroupUpdateSchema.safeParse({ degradedThreshold: 1.5 }).success).toBe(false);
  });
});
