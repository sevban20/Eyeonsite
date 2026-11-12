import { z } from 'zod';
import { isValidStatusCodeSpec } from './http-status';
import { NOTIFICATION_EVENTS, CHANNEL_TYPES } from './notifications';

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
  // Yalnizca yasam dongusu durumu istemciden yazilabilir. currentStatus olcum
  // sonucudur ve yalnizca pinger tarafindan yazilir; onceden istemci serbest
  // metin gonderip durum sayfasinda sahte "up" gosterebiliyordu.
  status: z.enum(['up', 'paused']).optional(),
  monitorType: monitorTypeEnum.optional(),
  port: z.number().int().min(1).max(65535).optional().nullable(),
  expectedKeyword: z.string().max(500).optional().nullable(),
  acceptedStatusCodes: z.string().max(200)
    .refine(isValidStatusCodeSpec, 'Use codes or ranges, e.g. "200-299,404"')
    .optional().nullable(),
  customHeaders: z.string().max(4000).optional().nullable(),
  heartbeatGrace: z.number().int().min(0).max(1440).optional(),
  groupId: z.string().uuid().optional().nullable(),
  tagIds: z.array(z.string().uuid()).max(50).optional()
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
// Returns an error message or null. The update route calls this on the MERGED
// record (existing row + patch), because a partial PUT usually omits monitorType.
export function monitorTargetError(data: { monitorType?: string | null; url?: string | null }): string | null {
  if (!data.monitorType || data.monitorType === 'HEARTBEAT') return null;
  if (!data.url) return 'URL/host is required for this monitor type';
  if (data.monitorType === 'HTTP') {
    try {
      const u = new URL(data.url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
    } catch {
      return 'A valid http(s) URL is required for HTTP monitors';
    }
  } else if (/[\s/]/.test(data.url)) {
    return 'Enter a bare host name or IP address (no scheme, path or spaces)';
  }
  return null;
}

export const validateMonitorTarget = (data: any, ctx: any) => {
  if (data.monitorType === undefined) return;
  const message = monitorTargetError(data);
  if (message) ctx.addIssue({ code: 'custom', path: ['url'], message });
};

export const monitorCreateSchema = monitorBaseSchema.extend(monitorCreateDefaults).superRefine(validateMonitorTarget);
// workspaceId guncellemede YOK: yetki yalnizca mevcut workspace icin kontrol
// edildiginden, govdeye baska bir workspace id'si yazmak monitoru o hesaba
// tasiyordu.
export const monitorUpdateSchema = monitorBaseSchema.omit({ workspaceId: true }).partial().superRefine(validateMonitorTarget);

// Same fix as above: `monitorIds` must NOT default to `[]` on the update
// schema, or editing just a status page's title (without resending the
// monitor list) would silently unlink every monitor from the page — the
// handler does `monitors: { set: monitorIds.map(...) } ` whenever
// `monitorIds` is present, and `[]` is truthy so it always "is present".
export const statusPageBaseSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  slug: z.string().regex(/^[A-Za-z0-9-]{1,64}$/, 'Slug may only contain letters, numbers and hyphens (max 64)'),
  monitorIds: z.array(z.string().uuid()).max(2000).optional(),
  themeColor: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional(),
  // Lokasyon (grup) baglari. monitorIds ile ayni tuzak gecerli: update
  // semasinda .default([]) OLMAMALI, yoksa yalnizca basligi degistiren bir PUT
  // sayfadaki tum gruplari koparir.
  groupIds: z.array(z.string().uuid()).max(500).optional(),
  showGroupMembers: z.boolean().optional(),
  // Sifre: bos string "korumayi kaldir" demek, bu yuzden min(8) yalnizca dolu
  // degerlere uygulanir. undefined ise mevcut sifreye dokunulmaz.
  password: z.union([z.literal(''), z.string().min(8).max(128)]).optional()
});
export const statusPageCreateSchema = z.object({ workspaceId: z.string().uuid() }).extend(statusPageBaseSchema.shape).extend({
  monitorIds: z.array(z.string().uuid()).max(2000).default([]),
  groupIds: z.array(z.string().uuid()).max(500).default([])
});
export const statusPageUpdateSchema = statusPageBaseSchema.partial();

export const maintenanceWindowCreateSchema = z.object({
  monitorId: z.string().uuid(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date()
});

// Formlar bos alanlari '' olarak gonderir; '' "degistirme" demektir. Onceden
// bos parola alani min(8)'e takildigi icin profil hic kaydedilemiyordu.
const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
export const userUpdateSchema = z.object({
  name: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().toLowerCase().email().optional()),
  password: z.preprocess(emptyToUndefined, z.string().min(8).max(128).optional()),
  // E-posta veya parola degisirken zorunlu (route kontrol eder).
  currentPassword: z.preprocess(emptyToUndefined, z.string().max(128).optional())
});

export const adminBlockSchema = z.object({ isBlocked: z.boolean() });
export const adminRoleSchema = z.object({ role: z.enum(['USER', 'SYSTEM_ADMIN']) });
export const adminSubscriptionSchema = z.object({
  plan: z.enum(['FREE', 'PRO']),
  expiresAt: z.coerce.date().optional().nullable()
});

// --- Faz 3.5: lokasyon (composite) alarmi ---
//
// Kanal seti API'ye nesne olarak gelir ama veritabaninda tek bir JSON string
// kolonunda durur. `.transform()` bunu sema seviyesinde yaptigi icin route'lar
// `data: parsed.data`'yi degistirmeden prisma'ya gecirmeye devam edebiliyor.
const groupChannelsObject = z.object({
  alertEmail: z.string().email().optional().or(z.literal('')),
  slackWebhook: z.string().url().optional().or(z.literal('')),
  telegramChatId: z.string().max(64).optional(),
  zoomWebhook: z.string().url().optional().or(z.literal('')),
  discordWebhook: z.string().url().optional().or(z.literal('')),
  teamsWebhook: z.string().url().optional().or(z.literal('')),
  genericWebhook: z.string().url().optional().or(z.literal(''))
}).strict();

export const groupChannelsSchema = groupChannelsObject
  .transform((v) => JSON.stringify(v))
  .nullable();

// Bu alanlar hem create hem update'te ayni: ikisinde de `.default()` YOK.
// Yukaridaki uzun nottaki zod v4 tuzagi burada da gecerli — grup adini
// degistiren bir PUT, gonderilmeyen composite alanlarini varsayilana
// dondurmemeli.
const compositeFields = {
  compositeEnabled: z.boolean().optional(),
  degradedThreshold: z.number().int().min(1).max(100).optional(),
  suppressMemberAlerts: z.boolean().optional(),
  degradedChannels: groupChannelsSchema.optional(),
  downChannels: groupChannelsSchema.optional()
};

export const monitorGroupCreateSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default('#f97316'),
  workspaceId: z.string().uuid(),
  ...compositeFields
});

export const monitorGroupUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional(),
  collapsed: z.boolean().optional(),
  order: z.number().int().optional(),
  ...compositeFields
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

// --- Merkezi bildirim yonetimi ---

const hexColor = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
const idList = (max: number) => z.array(z.string().uuid()).max(max);

export const tagCreateSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
  color: hexColor.optional()
});
export const tagUpdateSchema = z.object({ name: z.string().trim().min(1).max(40).optional(), color: hexColor.optional() });

export const teamCreateSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  color: hexColor.optional(),
  memberIds: idList(500).optional()
});
export const teamUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: hexColor.optional(),
  memberIds: idList(500).optional()
});

// config tipe gore lib/notifications.ts parseChannelConfig ile dogrulanir.
export const channelCreateSchema = z.object({
  workspaceId: z.string().uuid(),
  teamId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(80),
  type: z.enum(CHANNEL_TYPES),
  config: z.record(z.string(), z.any()),
  enabled: z.boolean().optional()
});
export const channelUpdateSchema = z.object({
  teamId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  config: z.record(z.string(), z.any()).optional(),
  enabled: z.boolean().optional()
});

const ruleFields = {
  teamId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(100),
  enabled: z.boolean().optional(),
  events: z.array(z.enum(NOTIFICATION_EVENTS)).min(1, 'Select at least one event').max(20),
  allMonitors: z.boolean().optional(),
  monitorIds: idList(5000).optional(),
  groupIds: idList(1000).optional(),
  tagIds: idList(500).optional(),
  channelIds: idList(100).min(1, 'Select at least one channel')
};
export const ruleCreateSchema = z.object({ workspaceId: z.string().uuid(), ...ruleFields });
export const ruleUpdateSchema = z.object(ruleFields).partial();

export const memberRoleSchema = z.object({ role: z.enum(['ADMIN', 'MEMBER']) });
