import { z } from 'zod';

// --- INPUT VALIDATION SCHEMAS ---
//
// IMPORTANT (found while adding test coverage — see lib/__tests__/validation.test.ts
// "regression" block): in the zod version pinned by this project (v4.4.2),
// `.partial()` does NOT suppress `.default(...)` the way it does in zod v3 —
// an omitted field still gets its default value filled in. Since the monitor
// *update* endpoint does `prisma.monitor.update({ data: parsed.data })`, any
// field carrying a bare `.default(...)` here would silently get reset to that
// default on every partial PUT — e.g. dragging a monitor into a group
// (`PUT /api/monitors/:id { groupId }`) or pausing one (`{ status }`) would
// reset method/interval/alertThreshold/notifyOnDegraded/sslCheckEnabled/
// heartbeatGrace/monitorType back to their defaults, and would additionally
// fail validation outright (monitorType defaults to HTTP, which then requires
// a `url` the partial payload never sent). Confirmed this was live-broken for
// both "pause/resume" and "move to group" before this fix.
//
// Fix: defaults live ONLY on the create schema (applied via .extend below).
// The shared base — used by both create and, via .partial(), update — carries
// no defaults, so an omitted field on update stays genuinely absent instead
// of being filled in and written back to the database.
const monitorTypeEnum = z.enum(['HTTP', 'TCP', 'PING', 'HEARTBEAT']);
const monitorMethodEnum = z.enum(['GET', 'POST', 'HEAD', 'PUT', 'DELETE']);

export const monitorBaseSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().max(2048).optional().nullable(), // required per-type via validateMonitorTarget (HEARTBEAT needs none)
  method: monitorMethodEnum.optional(),
  interval: z.number().int().min(10).max(86400).optional(),
  workspaceId: z.string().uuid(),
  alertEmail: z.string().email().optional().or(z.literal('')),
  slackWebhook: z.string().url().optional().or(z.literal('')),
  telegramChatId: z.string().optional(),
  zoomWebhook: z.string().url().optional().or(z.literal('')),
  discordWebhook: z.string().url().optional().or(z.literal('')),
  teamsWebhook: z.string().url().optional().or(z.literal('')),
  genericWebhook: z.string().url().optional().or(z.literal('')),
  alertThreshold: z.number().int().min(1).max(10).optional(),
  responseTimeThreshold: z.number().int().min(100).max(60000).optional().nullable(),
  notifyOnDegraded: z.boolean().optional(),
  sslCheckEnabled: z.boolean().optional(),
  status: z.string().optional(),
  currentStatus: z.string().optional(),
  monitorType: monitorTypeEnum.optional(),
  port: z.number().int().min(1).max(65535).optional().nullable(),
  expectedKeyword: z.string().max(500).optional().nullable(),
  customHeaders: z.string().max(4000).optional().nullable(),
  heartbeatGrace: z.number().int().min(0).max(1440).optional(),
  groupId: z.string().uuid().optional().nullable()
});

// Defaults applied only at creation time — see note above.
const monitorCreateDefaults = {
  method: monitorMethodEnum.default('GET'),
  interval: z.number().int().min(10).max(86400).default(60),
  alertThreshold: z.number().int().min(1).max(10).default(2),
  notifyOnDegraded: z.boolean().default(false),
  sslCheckEnabled: z.boolean().default(true),
  monitorType: monitorTypeEnum.default('HTTP'),
  heartbeatGrace: z.number().int().min(0).max(1440).default(5)
};

// Target validation per monitor type. HTTP requires a valid http(s) URL
// (prevents javascript:, file:, etc.); TCP/PING require a host; HEARTBEAT needs none.
// Skipped on partial updates that don't include monitorType.
export const validateMonitorTarget = (data: any, ctx: any) => {
  if (data.monitorType === undefined || data.monitorType === 'HEARTBEAT') return;
  if (!data.url) {
    ctx.addIssue({ code: 'custom', path: ['url'], message: 'URL/host is required for this monitor type' });
    return;
  }
  if (data.monitorType === 'HTTP') {
    try {
      const u = new URL(data.url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
    } catch {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'A valid http(s) URL is required for HTTP monitors' });
    }
  }
};

export const monitorCreateSchema = monitorBaseSchema.extend(monitorCreateDefaults).superRefine(validateMonitorTarget);
export const monitorUpdateSchema = monitorBaseSchema.partial().superRefine(validateMonitorTarget);

// Same fix as above: `monitorIds` must NOT default to `[]` on the update
// schema, or editing just a status page's title (without resending the
// monitor list) would silently unlink every monitor from the page — the
// handler does `monitors: { set: monitorIds.map(...) } ` whenever
// `monitorIds` is present, and `[]` is truthy so it always "is present".
export const statusPageBaseSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  slug: z.string().regex(/^[A-Za-z0-9-]{1,64}$/, 'Slug may only contain letters, numbers and hyphens (max 64)'),
  monitorIds: z.array(z.string().uuid()).max(200).optional()
});
export const statusPageCreateSchema = z.object({ workspaceId: z.string().uuid() }).extend(statusPageBaseSchema.shape).extend({
  monitorIds: z.array(z.string().uuid()).max(200).default([])
});
export const statusPageUpdateSchema = statusPageBaseSchema.partial();

export const maintenanceWindowCreateSchema = z.object({
  monitorId: z.string().uuid(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date()
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(128).optional()
});

export const monitorGroupCreateSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default('#f97316'),
  workspaceId: z.string().uuid()
});

export const monitorGroupUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional(),
  collapsed: z.boolean().optional(),
  order: z.number().int().optional()
});

// --- Faz 1 additions ---
export const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
  workspaceId: z.string().uuid()
});

export const totpVerifySchema = z.object({
  token: z.string().regex(/^[0-9]{6}$/, 'Enter the 6-digit code')
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional()
});
