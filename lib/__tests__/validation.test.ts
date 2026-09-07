import { describe, it, expect } from 'vitest';
import {
  monitorCreateSchema,
  monitorUpdateSchema,
  statusPageCreateSchema,
  statusPageUpdateSchema,
  userUpdateSchema,
  apiKeyCreateSchema,
  totpVerifySchema
} from '../validation';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';

describe('monitorCreateSchema', () => {
  it('accepts a valid HTTP monitor', () => {
    const result = monitorCreateSchema.safeParse({
      name: 'My site',
      url: 'https://example.com',
      workspaceId: WORKSPACE_ID
    });
    expect(result.success).toBe(true);
  });

  it('rejects an HTTP monitor with no url', () => {
    const result = monitorCreateSchema.safeParse({
      name: 'My site',
      monitorType: 'HTTP',
      workspaceId: WORKSPACE_ID
    });
    expect(result.success).toBe(false);
  });

  it('rejects a javascript: URL (protocol allowlist)', () => {
    const result = monitorCreateSchema.safeParse({
      name: 'XSS attempt',
      url: 'javascript:alert(1)',
      workspaceId: WORKSPACE_ID
    });
    expect(result.success).toBe(false);
  });

  it('rejects a file: URL', () => {
    const result = monitorCreateSchema.safeParse({
      name: 'Local file',
      url: 'file:///etc/passwd',
      workspaceId: WORKSPACE_ID
    });
    expect(result.success).toBe(false);
  });

  it('requires a host for TCP monitors', () => {
    const result = monitorCreateSchema.safeParse({
      name: 'TCP check',
      monitorType: 'TCP',
      port: 5432,
      workspaceId: WORKSPACE_ID
    });
    expect(result.success).toBe(false);
  });

  it('allows a HEARTBEAT monitor with no url', () => {
    const result = monitorCreateSchema.safeParse({
      name: 'Cron job',
      monitorType: 'HEARTBEAT',
      workspaceId: WORKSPACE_ID
    });
    expect(result.success).toBe(true);
  });

  it('rejects an out-of-range port', () => {
    const result = monitorCreateSchema.safeParse({
      name: 'Bad port',
      monitorType: 'TCP',
      url: 'db.example.com',
      port: 70000,
      workspaceId: WORKSPACE_ID
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid workspaceId', () => {
    const result = monitorCreateSchema.safeParse({
      name: 'My site',
      url: 'https://example.com',
      workspaceId: 'not-a-uuid'
    });
    expect(result.success).toBe(false);
  });
});

describe('monitorUpdateSchema (partial)', () => {
  it('allows updating unrelated fields without url/monitorType', () => {
    const result = monitorUpdateSchema.safeParse({ interval: 120 });
    expect(result.success).toBe(true);
  });

  it('still enforces the URL requirement when monitorType is switched to HTTP', () => {
    const result = monitorUpdateSchema.safeParse({ monitorType: 'HTTP' });
    expect(result.success).toBe(false);
  });

  // Regression tests for a live bug this test suite uncovered: zod v4's
  // .partial() still applies .default(...) for omitted fields, which used to
  // make monitorUpdateSchema fill in monitorType/method/interval/etc. on every
  // partial PUT — breaking pause/resume and "move monitor to group" outright
  // (400: "URL/host is required"), and would have silently reset those fields
  // to their schema defaults for any request that *did* pass validation.
  it('regression: pausing/resuming a monitor ({ status }) succeeds and touches nothing else', () => {
    const result = monitorUpdateSchema.safeParse({ status: 'paused' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ status: 'paused' });
    }
  });

  it('regression: moving a monitor to a group ({ groupId }) succeeds and touches nothing else', () => {
    const groupId = '22222222-2222-4222-8222-222222222222';
    const result = monitorUpdateSchema.safeParse({ groupId });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ groupId });
    }
  });
});

describe('statusPageCreateSchema', () => {
  it('accepts a clean slug', () => {
    const result = statusPageCreateSchema.safeParse({
      workspaceId: WORKSPACE_ID,
      title: 'Status',
      slug: 'my-status-page'
    });
    expect(result.success).toBe(true);
  });

  it('rejects a slug with spaces or slashes', () => {
    const result = statusPageCreateSchema.safeParse({
      workspaceId: WORKSPACE_ID,
      title: 'Status',
      slug: 'my status/page'
    });
    expect(result.success).toBe(false);
  });
});

describe('statusPageUpdateSchema (partial)', () => {
  // Regression test: editing only the title used to implicitly default
  // monitorIds to [], and since PublicStatusPage.monitors gets `set` to
  // exactly that list whenever monitorIds is present (and [] is truthy),
  // every monitor would be silently unlinked from the status page.
  it('regression: updating only the title does not touch monitorIds', () => {
    const result = statusPageUpdateSchema.safeParse({ title: 'New title' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ title: 'New title' });
      expect('monitorIds' in result.data).toBe(false);
    }
  });

  it('still allows explicitly replacing the monitor list', () => {
    const result = statusPageUpdateSchema.safeParse({ monitorIds: [WORKSPACE_ID] });
    expect(result.success).toBe(true);
  });
});

describe('userUpdateSchema', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(userUpdateSchema.safeParse({ password: 'short' }).success).toBe(false);
  });

  it('accepts an 8+ character password', () => {
    expect(userUpdateSchema.safeParse({ password: 'longenough' }).success).toBe(true);
  });
});

describe('apiKeyCreateSchema', () => {
  it('requires a name and a valid workspaceId', () => {
    expect(apiKeyCreateSchema.safeParse({ name: 'CI key', workspaceId: WORKSPACE_ID }).success).toBe(true);
    expect(apiKeyCreateSchema.safeParse({ name: '', workspaceId: WORKSPACE_ID }).success).toBe(false);
  });
});

describe('totpVerifySchema', () => {
  it('accepts a 6-digit code', () => {
    expect(totpVerifySchema.safeParse({ token: '123456' }).success).toBe(true);
  });

  it('rejects a non-numeric or wrong-length code', () => {
    expect(totpVerifySchema.safeParse({ token: '12345' }).success).toBe(false);
    expect(totpVerifySchema.safeParse({ token: 'abcdef' }).success).toBe(false);
  });
});
