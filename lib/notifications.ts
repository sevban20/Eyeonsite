/**
 * Merkezi bildirim yonetimi — saf mantik (veritabani ve ag yok, test edilebilir).
 *
 *   Kanal  : bildirimin gidecegi yer (Slack, e-posta, ...)
 *   Kural  : kapsam (tum monitorler / lokasyonlar / etiketler / monitorler)
 *            + olaylar + kanallar
 *   Ekip   : is birimi; kanal ve kurallar bir ekibe ait olabilir.
 *
 * server.ts bu modulu kullanarak bir olay icin hangi kanallara gidilecegini
 * hesaplar; gonderim ve kayit isi orada yapilir.
 */
import { z } from 'zod';

// ─── Olaylar ─────────────────────────────────────────────────────────────────
export const MONITOR_EVENTS = ['down', 'degraded', 'up', 'ssl_expiry', 'heartbeat_missed'] as const;
export const LOCATION_EVENTS = ['location_degraded', 'location_down', 'location_up'] as const;
export const NOTIFICATION_EVENTS = [...MONITOR_EVENTS, ...LOCATION_EVENTS] as const;
export type NotificationEvent = typeof NOTIFICATION_EVENTS[number];

// ─── Kanallar ────────────────────────────────────────────────────────────────
export const CHANNEL_TYPES = ['email', 'slack', 'teams', 'discord', 'telegram', 'zoom', 'webhook'] as const;
export type ChannelType = typeof CHANNEL_TYPES[number];

const emailList = z.string().trim().min(3).max(1000).refine(
  (v) => v.split(/[,;\s]+/).filter(Boolean).every((e) => z.string().email().safeParse(e).success),
  'Enter one or more valid email addresses separated by commas'
);
const httpsUrl = z.string().trim().url().max(2048).refine((v) => /^https?:\/\//i.test(v), 'A valid http(s) URL is required');

export const channelConfigSchemas: Record<ChannelType, z.ZodTypeAny> = {
  email: z.object({ to: emailList }).strict(),
  slack: z.object({ url: httpsUrl }).strict(),
  teams: z.object({ url: httpsUrl }).strict(),
  discord: z.object({ url: httpsUrl }).strict(),
  zoom: z.object({ url: httpsUrl }).strict(),
  webhook: z.object({ url: httpsUrl }).strict(),
  telegram: z.object({ chatId: z.string().trim().min(1).max(64) }).strict()
};

export function parseChannelConfig(type: string, config: unknown): { ok: boolean; value?: Record<string, string>; error?: string } {
  if (!(CHANNEL_TYPES as readonly string[]).includes(type)) return { ok: false, error: 'type: Unknown channel type' };
  const r = channelConfigSchemas[type as ChannelType].safeParse(config);
  if (!r.success) {
    const issue = r.error.issues[0];
    return { ok: false, error: `${issue?.path?.length ? issue.path.join('.') : 'config'}: ${issue?.message || 'Invalid configuration'}` };
  }
  return { ok: true, value: r.data as Record<string, string> };
}

export function emailRecipients(to: string): string[] {
  return to.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
}

// ─── Kural eslestirme ────────────────────────────────────────────────────────
export interface RuleLike {
  id: string;
  enabled: boolean;
  events: string[];
  allMonitors: boolean;
  monitorIds: string[];
  groupIds: string[];
  tagIds: string[];
  channelIds: string[];
}

export interface MonitorLike {
  id: string;
  groupId?: string | null;
  tagIds: string[];
}

/** Kural bu monitoru kapsiyor mu? (monitor olaylari icin) */
export function ruleCoversMonitor(rule: RuleLike, monitor: MonitorLike): boolean {
  if (rule.allMonitors) return true;
  if (rule.monitorIds.includes(monitor.id)) return true;
  if (monitor.groupId && rule.groupIds.includes(monitor.groupId)) return true;
  return monitor.tagIds.some((t) => rule.tagIds.includes(t));
}

/** Kural bu lokasyonu kapsiyor mu? (lokasyon olaylari icin) */
export function ruleCoversGroup(rule: RuleLike, groupId: string): boolean {
  return rule.allMonitors || rule.groupIds.includes(groupId);
}

export interface MatchContext {
  /** Toparlanma olayinda olayi baslatan durum: 'down' | 'degraded'. Kural yalnizca
   *  olayin baslangicina da abone ise toparlanmayi alir; aksi halde hic haber
   *  vermedigimiz bir olayin "duzeldi" bildirimi giderdi. */
  recoveredFrom?: string | null;
  /** Lokasyon toparlanmasinda cikilan durum: 'location_degraded' | 'location_down'. */
  locationRecoveredFrom?: string | null;
}

/** Olayi almasi gereken kurallar. */
export function matchingRules(
  rules: RuleLike[],
  event: NotificationEvent,
  target: { monitor?: MonitorLike; groupId?: string },
  ctx: MatchContext = {}
): RuleLike[] {
  return rules.filter((rule) => {
    if (!rule.enabled || !rule.events.includes(event)) return false;
    if (event === 'up' && ctx.recoveredFrom && !rule.events.includes(ctx.recoveredFrom)) return false;
    if (event === 'location_up' && ctx.locationRecoveredFrom && !rule.events.includes(ctx.locationRecoveredFrom)) return false;
    if ((LOCATION_EVENTS as readonly string[]).includes(event)) {
      return !!target.groupId && ruleCoversGroup(rule, target.groupId);
    }
    return !!target.monitor && ruleCoversMonitor(rule, target.monitor);
  });
}

/** Eslesen kurallarin kanallari, tekrarsiz. Her kanal icin ilk eslesen kural da doner (log icin). */
export function channelsForRules(rules: RuleLike[]): { channelId: string; ruleId: string }[] {
  const seen = new Map<string, string>();
  for (const r of rules) for (const c of r.channelIds) if (!seen.has(c)) seen.set(c, r.id);
  return [...seen.entries()].map(([channelId, ruleId]) => ({ channelId, ruleId }));
}

// ─── Yetki ───────────────────────────────────────────────────────────────────
export interface Actor { isAdmin: boolean; teamIds: string[] }

/**
 * Bir kanal/kurali duzenleyebilir mi? Yonetici her seyi; uye yalnizca kendi
 * ekiplerinden birine ait olanlari. Ekipsiz (workspace geneli) kayitlar yalnizca
 * yoneticiye aittir.
 */
export function canManageNotificationItem(actor: Actor, teamId: string | null | undefined): boolean {
  if (actor.isAdmin) return true;
  return !!teamId && actor.teamIds.includes(teamId);
}

// ─── Mesaj ───────────────────────────────────────────────────────────────────
const EVENT_TITLES: Record<NotificationEvent, string> = {
  down: '🚨 KESİNTİ / OUTAGE',
  degraded: '⚠️ PERFORMANS DÜŞÜŞÜ / DEGRADED',
  up: '✅ TOPARLANDI / RECOVERED',
  ssl_expiry: '🔒 SSL SERTİFİKASI BİTİYOR / SSL EXPIRING',
  heartbeat_missed: '💔 HEARTBEAT GELMEDİ / HEARTBEAT MISSED',
  location_degraded: '⚠️ LOKASYON KISMİ KESİNTİ / PARTIAL OUTAGE',
  location_down: '🚨 LOKASYON TAM KESİNTİ / LOCATION DOWN',
  location_up: '✅ LOKASYON TOPARLANDI / LOCATION RECOVERED'
};

export function eventTitle(event: NotificationEvent | 'test'): string {
  return event === 'test' ? '🔔 TEST BİLDİRİMİ / TEST NOTIFICATION' : EVENT_TITLES[event];
}

export function formatMessage(event: NotificationEvent | 'test', subject: string, opts: { url?: string | null; reason?: string | null; at?: Date } = {}): string {
  const lines = [eventTitle(event), `${subject}`];
  if (opts.url) lines.push(`URL: ${opts.url}`);
  if (opts.reason) lines.push(`${opts.reason}`);
  lines.push((opts.at || new Date()).toISOString());
  return lines.join('\n');
}

// ─── Eski ayarlarin tasinmasi ────────────────────────────────────────────────
// Onceden her monitorde alertEmail/slackWebhook/... alanlari, lokasyonlarda ise
// degradedChannels/downChannels JSON'u vardi. Ilk acilista bunlar kanal+kurala
// donusturulur; davranis birebir korunur.

export const LEGACY_FIELDS: { field: string; type: ChannelType; key: 'to' | 'url' | 'chatId'; label: string }[] = [
  { field: 'alertEmail', type: 'email', key: 'to', label: 'E-posta' },
  { field: 'slackWebhook', type: 'slack', key: 'url', label: 'Slack' },
  { field: 'telegramChatId', type: 'telegram', key: 'chatId', label: 'Telegram' },
  { field: 'zoomWebhook', type: 'zoom', key: 'url', label: 'Zoom' },
  { field: 'discordWebhook', type: 'discord', key: 'url', label: 'Discord' },
  { field: 'teamsWebhook', type: 'teams', key: 'url', label: 'Teams' },
  { field: 'genericWebhook', type: 'webhook', key: 'url', label: 'Webhook' }
];

export interface LegacyMonitor { id: string; name: string; notifyOnDegraded?: boolean; [field: string]: any }
export interface LegacyGroup { id: string; name: string; compositeEnabled?: boolean; degradedChannels?: string | null; downChannels?: string | null }

export interface PlannedChannel { key: string; name: string; type: ChannelType; config: Record<string, string> }
export interface PlannedRule { name: string; events: NotificationEvent[]; monitorIds: string[]; groupIds: string[]; channelKeys: string[] }

function shortValue(v: string): string {
  try { const u = new URL(v); return u.hostname + (u.pathname.length > 1 ? '/…' + u.pathname.slice(-6) : ''); } catch { return v.length > 32 ? v.slice(0, 29) + '…' : v; }
}

export function planLegacyMigration(monitors: LegacyMonitor[], groups: LegacyGroup[]): { channels: PlannedChannel[]; rules: PlannedRule[] } {
  const channels = new Map<string, PlannedChannel>();
  const addChannel = (type: ChannelType, key: 'to' | 'url' | 'chatId', raw: string, label: string): string | null => {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) return null;
    const parsed = parseChannelConfig(type, { [key]: value });
    if (!parsed.ok) return null; // gecersiz eski deger tasinmaz (zaten calismiyordu)
    const id = `${type}|${value.toLowerCase()}`;
    if (!channels.has(id)) channels.set(id, { key: id, name: `${label}: ${shortValue(value)}`, type, config: parsed.value! });
    return id;
  };

  // Ayni kanal kumesine ve ayni degraded tercihine sahip monitorler tek kuralda toplanir.
  const monitorBuckets = new Map<string, { channelKeys: string[]; degraded: boolean; monitorIds: string[] }>();
  for (const m of monitors) {
    const keys = LEGACY_FIELDS.map((f) => addChannel(f.type, f.key, m[f.field], f.label)).filter(Boolean) as string[];
    if (keys.length === 0) continue;
    const sorted = [...new Set(keys)].sort();
    const bucketKey = `${sorted.join(',')}#${m.notifyOnDegraded ? 1 : 0}`;
    if (!monitorBuckets.has(bucketKey)) monitorBuckets.set(bucketKey, { channelKeys: sorted, degraded: !!m.notifyOnDegraded, monitorIds: [] });
    monitorBuckets.get(bucketKey)!.monitorIds.push(m.id);
  }

  const rules: PlannedRule[] = [];
  let n = 1;
  for (const b of monitorBuckets.values()) {
    const events: NotificationEvent[] = ['down', 'up', 'ssl_expiry', 'heartbeat_missed'];
    if (b.degraded) events.splice(1, 0, 'degraded');
    rules.push({ name: `Taşınan kural ${n++} (${b.monitorIds.length} monitör)`, events, monitorIds: b.monitorIds, groupIds: [], channelKeys: b.channelKeys });
  }

  for (const g of groups) {
    for (const [field, event] of [['degradedChannels', 'location_degraded'], ['downChannels', 'location_down']] as const) {
      const raw = g[field];
      if (!raw) continue;
      let obj: any = {};
      try { obj = JSON.parse(raw) || {}; } catch { continue; }
      const keys = LEGACY_FIELDS.map((f) => addChannel(f.type, f.key, obj[f.field], f.label)).filter(Boolean) as string[];
      if (keys.length === 0) continue;
      rules.push({
        name: `${g.name} — ${event === 'location_down' ? 'tam kesinti' : 'kısmi kesinti'}`,
        events: [event, 'location_up'],
        monitorIds: [], groupIds: [g.id], channelKeys: [...new Set(keys)]
      });
    }
  }

  return { channels: [...channels.values()], rules };
}
