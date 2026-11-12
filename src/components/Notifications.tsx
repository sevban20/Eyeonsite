import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Plus, Trash2, Edit2, Send, Users, Tag as TagIcon, History, Radio, CheckCircle2, XCircle, X, Lock, RefreshCw, Search } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { toast } from 'sonner';
import api from '../lib/api';
import { useTranslation } from '../lib/i18n';

/**
 * Merkezi bildirim yonetimi.
 *   Kurallar : kapsam (tum / lokasyon / etiket / monitor) + olaylar + kanallar
 *   Kanallar : bildirimin gidecegi yerler, bir kez tanimlanir
 *   Ekipler  : is birimleri; uye rolundekiler yalnizca kendi ekiplerinin
 *              kanal ve kurallarini duzenler
 *   Etiketler: bir monitor birden cok etiket alabilir (ayni uygulama hem bir
 *              alan adina hem bir is birimine ait olabilir)
 *   Gecmis   : gonderilen bildirimler ve basarisizliklar
 */

type Tab = 'rules' | 'channels' | 'teams' | 'tags' | 'history';

const CONFIG_FIELD: Record<string, 'to' | 'url' | 'chatId'> = {
  email: 'to', slack: 'url', teams: 'url', discord: 'url', zoom: 'url', webhook: 'url', telegram: 'chatId'
};
const PLACEHOLDER: Record<string, string> = {
  email: 'ops@ornek.com, nobetci@ornek.com', slack: 'https://hooks.slack.com/services/...',
  teams: 'https://outlook.office.com/webhook/...', discord: 'https://discord.com/api/webhooks/...',
  zoom: 'https://integrations.zoom.us/chat/webhooks/...', webhook: 'https://servisim.com/webhook', telegram: '-100123456789'
};
const COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#eab308', '#ec4899', '#71717a'];

const inputCls = 'w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-orange-500 transition-colors text-sm';
const labelCls = 'block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2';

function Chip({ active, onClick, children, color, disabled }: any) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors disabled:opacity-40 ${
        active ? 'bg-orange-500/15 border-orange-500/40 text-orange-300' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
      }`}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
      {children}
    </button>
  );
}

function Modal({ title, onClose, children, wide }: any) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 sm:p-8 shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold font-display text-white">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Notifications({ workspace }: { workspace: any }) {
  const { t, language, apiError } = useTranslation();
  const dateLocale = language === 'tr' ? trLocale : undefined;
  const [tab, setTab] = useState<Tab>('rules');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [failedOnly, setFailedOnly] = useState(false);

  const [ruleForm, setRuleForm] = useState<any | null>(null);
  const [channelForm, setChannelForm] = useState<any | null>(null);
  const [teamForm, setTeamForm] = useState<any | null>(null);
  const [tagMonitors, setTagMonitors] = useState<any | null>(null);
  const [newTag, setNewTag] = useState('');
  const [monitorSearch, setMonitorSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!workspace) return;
    try {
      const res = await api.get(`/notifications/bootstrap?workspaceId=${workspace.id}`);
      setData(res.data);
    } catch (err) {
      toast.error(apiError(err, 'notifications.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, apiError]);

  const loadLogs = useCallback(async () => {
    if (!workspace) return;
    try {
      const res = await api.get(`/notification-logs?workspaceId=${workspace.id}&limit=200${failedOnly ? '&failed=1' : ''}`);
      setLogs(res.data);
    } catch (err) {
      toast.error(apiError(err, 'notifications.load_failed'));
    }
  }, [workspace?.id, failedOnly, apiError]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'history') loadLogs(); }, [tab, loadLogs]);

  const actor = data?.actor || { isAdmin: false, teamIds: [] };
  const canCreate = actor.isAdmin || actor.teamIds.length > 0;
  const teamById = useMemo(() => new Map((data?.teams || []).map((x: any) => [x.id, x])), [data]);
  const channelById = useMemo(() => new Map((data?.channels || []).map((x: any) => [x.id, x])), [data]);
  const tagById = useMemo(() => new Map((data?.tags || []).map((x: any) => [x.id, x])), [data]);
  const groupById = useMemo(() => new Map((data?.groups || []).map((x: any) => [x.id, x])), [data]);
  const monitorById = useMemo(() => new Map((data?.monitors || []).map((x: any) => [x.id, x])), [data]);
  const personById = useMemo(() => new Map((data?.people || []).map((x: any) => [x.userId, x])), [data]);

  // Uyenin secebilecegi ekipler: yonetici hepsini ve "workspace geneli"ni,
  // uye yalnizca kendi ekiplerini.
  const assignableTeams = (data?.teams || []).filter((tm: any) => actor.isAdmin || actor.teamIds.includes(tm.id));
  const usableChannels = (data?.channels || []).filter((c: any) => actor.isAdmin || !c.teamId || actor.teamIds.includes(c.teamId));

  const eventLabel = (e: string) => t(`notifications.events.${e}`);
  const typeLabel = (ty: string) => t(`notifications.types.${ty}`);

  const coveredCount = (r: any) => {
    if (r.allMonitors) return (data?.monitors || []).length;
    return (data?.monitors || []).filter((m: any) =>
      r.monitorIds.includes(m.id) || (m.groupId && r.groupIds.includes(m.groupId)) || m.tagIds.some((x: string) => r.tagIds.includes(x))
    ).length;
  };

  // ── Kurallar ─────────────────────────────────────────────────────────────
  const openNewRule = () => setRuleForm({
    name: '', teamId: actor.isAdmin ? null : (assignableTeams[0]?.id || null), enabled: true,
    events: ['down', 'up'], allMonitors: false, monitorIds: [], groupIds: [], tagIds: [], channelIds: []
  });
  const toggleIn = (key: string, id: string) => setRuleForm((f: any) => ({
    ...f, [key]: f[key].includes(id) ? f[key].filter((x: string) => x !== id) : [...f[key], id]
  }));
  const saveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.allMonitors && !ruleForm.monitorIds.length && !ruleForm.groupIds.length && !ruleForm.tagIds.length) {
      toast.error(t('notifications.rule_scope_required')); return;
    }
    if (!ruleForm.channelIds.length) { toast.error(t('notifications.rule_channel_required')); return; }
    if (!ruleForm.events.length) { toast.error(t('notifications.rule_event_required')); return; }
    setSaving(true);
    try {
      const { id, canManage, ...body } = ruleForm;
      if (id) await api.put(`/notification-rules/${id}`, body);
      else await api.post('/notification-rules', { ...body, workspaceId: workspace.id });
      toast.success(t('notifications.rule_saved'));
      setRuleForm(null);
      load();
    } catch (err) {
      toast.error(apiError(err, 'notifications.save_failed'));
    } finally { setSaving(false); }
  };
  const toggleRule = async (r: any) => {
    try { await api.put(`/notification-rules/${r.id}`, { enabled: !r.enabled }); load(); }
    catch (err) { toast.error(apiError(err, 'notifications.save_failed')); }
  };
  const deleteRule = async (r: any) => {
    if (!window.confirm(t('notifications.confirm_delete_rule').replace('{name}', r.name))) return;
    try { await api.delete(`/notification-rules/${r.id}`); toast.success(t('notifications.deleted')); load(); }
    catch (err) { toast.error(apiError(err, 'notifications.save_failed')); }
  };

  // ── Kanallar ─────────────────────────────────────────────────────────────
  const openNewChannel = () => setChannelForm({ name: '', type: 'email', value: '', teamId: actor.isAdmin ? null : (assignableTeams[0]?.id || null), enabled: true });
  const saveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const field = CONFIG_FIELD[channelForm.type];
      const body: any = { name: channelForm.name, teamId: channelForm.teamId || null, enabled: channelForm.enabled };
      if (!channelForm.id || channelForm.value !== channelForm.originalValue) body.config = { [field]: channelForm.value };
      if (channelForm.id) await api.put(`/notification-channels/${channelForm.id}`, body);
      else await api.post('/notification-channels', { ...body, type: channelForm.type, workspaceId: workspace.id, config: { [field]: channelForm.value } });
      toast.success(t('notifications.channel_saved'));
      setChannelForm(null);
      load();
    } catch (err) {
      toast.error(apiError(err, 'notifications.save_failed'));
    } finally { setSaving(false); }
  };
  const testChannel = async (c: any) => {
    const id = toast.loading(t('notifications.testing'));
    try {
      const res = await api.post(`/notification-channels/${c.id}/test`);
      if (res.data.ok) toast.success(t('notifications.test_ok'), { id });
      else toast.error(`${t('notifications.test_failed')}: ${res.data.error}`, { id });
      load();
    } catch (err) {
      toast.error(apiError(err, 'notifications.test_failed'), { id });
    }
  };
  const deleteChannel = async (c: any) => {
    const msg = c.ruleCount ? t('notifications.confirm_delete_channel_used').replace('{count}', String(c.ruleCount)) : t('notifications.confirm_delete_channel');
    if (!window.confirm(msg.replace('{name}', c.name))) return;
    try { await api.delete(`/notification-channels/${c.id}`); toast.success(t('notifications.deleted')); load(); }
    catch (err) { toast.error(apiError(err, 'notifications.save_failed')); }
  };

  // ── Ekipler ──────────────────────────────────────────────────────────────
  const saveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name: teamForm.name, color: teamForm.color, memberIds: teamForm.memberIds };
      if (teamForm.id) await api.put(`/teams/${teamForm.id}`, body);
      else await api.post('/teams', { ...body, workspaceId: workspace.id });
      toast.success(t('notifications.team_saved'));
      setTeamForm(null);
      load();
    } catch (err) {
      toast.error(apiError(err, 'notifications.save_failed'));
    } finally { setSaving(false); }
  };
  const deleteTeam = async (tm: any) => {
    if (!window.confirm(t('notifications.confirm_delete_team').replace('{name}', tm.name))) return;
    try { await api.delete(`/teams/${tm.id}`); toast.success(t('notifications.deleted')); load(); }
    catch (err) { toast.error(apiError(err, 'notifications.save_failed')); }
  };

  // ── Etiketler ────────────────────────────────────────────────────────────
  const createTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    try {
      await api.post('/tags', { workspaceId: workspace.id, name: newTag.trim(), color: COLORS[(data?.tags?.length || 0) % COLORS.length] });
      setNewTag('');
      load();
    } catch (err) { toast.error(apiError(err, 'notifications.save_failed')); }
  };
  const deleteTag = async (tg: any) => {
    if (!window.confirm(t('notifications.confirm_delete_tag').replace('{name}', tg.name))) return;
    try { await api.delete(`/tags/${tg.id}`); toast.success(t('notifications.deleted')); load(); }
    catch (err) { toast.error(apiError(err, 'notifications.save_failed')); }
  };
  const saveTagMonitors = async () => {
    setSaving(true);
    try {
      await api.put(`/tags/${tagMonitors.id}/monitors`, { monitorIds: tagMonitors.monitorIds });
      toast.success(t('notifications.tag_saved'));
      setTagMonitors(null);
      load();
    } catch (err) { toast.error(apiError(err, 'notifications.save_failed')); }
    finally { setSaving(false); }
  };

  if (loading || !data) {
    return <div className="max-w-6xl mx-auto px-6 py-20 text-center text-zinc-500 text-sm">{t('common.loading')}</div>;
  }

  const filteredMonitors = (data.monitors || []).filter((m: any) => !monitorSearch || m.name.toLowerCase().includes(monitorSearch.toLowerCase()));

  const TeamBadge = ({ teamId }: { teamId: string | null }) => {
    const tm: any = teamId ? teamById.get(teamId) : null;
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tm?.color || '#71717a' }} />
        {tm ? tm.name : t('notifications.workspace_wide')}
      </span>
    );
  };

  const tabs: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: 'rules', label: t('notifications.tab_rules'), icon: Bell, count: data.rules.length },
    { id: 'channels', label: t('notifications.tab_channels'), icon: Radio, count: data.channels.length },
    { id: 'teams', label: t('notifications.tab_teams'), icon: Users, count: data.teams.length },
    { id: 'tags', label: t('notifications.tab_tags'), icon: TagIcon, count: data.tags.length },
    { id: 'history', label: t('notifications.tab_history'), icon: History }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
      <header className="mb-10">
        <div className="flex items-center gap-2 text-orange-500 font-bold text-xs uppercase tracking-[0.2em] mb-3">
          <Bell className="w-4 h-4" /> {t('notifications.overline')}
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-2 font-display">{t('notifications.title')}</h1>
        <p className="text-zinc-500 max-w-2xl">{t('notifications.subtitle')}</p>
        {!actor.isAdmin && (
          <p className="mt-4 inline-flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
            <Lock className="w-3.5 h-3.5" /> {actor.teamIds.length ? t('notifications.member_hint') : t('notifications.member_no_team_hint')}
          </p>
        )}
      </header>

      <div className="flex gap-1 p-1 bg-zinc-900/60 border border-zinc-800 rounded-2xl mb-8 overflow-x-auto">
        {tabs.map(x => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${tab === x.id ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
          >
            <x.icon className="w-4 h-4" /> {x.label}
            {x.count !== undefined && <span className={`text-[10px] px-1.5 rounded-full ${tab === x.id ? 'bg-zinc-200' : 'bg-zinc-800'}`}>{x.count}</span>}
          </button>
        ))}
      </div>

      {/* ── KURALLAR ── */}
      {tab === 'rules' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">{t('notifications.rules_desc')}</p>
            {canCreate && (
              <button onClick={openNewRule} disabled={!usableChannels.length} title={!usableChannels.length ? t('notifications.need_channel_first') : undefined}
                className="shrink-0 bg-white text-zinc-950 px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 disabled:opacity-40">
                <Plus className="w-4 h-4" /> {t('notifications.new_rule')}
              </button>
            )}
          </div>
          {canCreate && !usableChannels.length && (
            <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-300">
              {t('notifications.need_channel_first')} <button className="underline font-bold" onClick={() => setTab('channels')}>{t('notifications.go_channels')}</button>
            </div>
          )}
          {data.rules.length === 0 && <div className="py-16 text-center border-2 border-dashed border-zinc-900 rounded-3xl text-zinc-500 text-sm">{t('notifications.no_rules')}</div>}
          {data.rules.map((r: any) => (
            <div key={r.id} className={`glass rounded-3xl p-5 sm:p-6 border ${r.enabled ? 'border-white/5' : 'border-white/5 opacity-60'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white">{r.name}</h3>
                    <TeamBadge teamId={r.teamId} />
                    {!r.enabled && <span className="text-[10px] font-bold text-zinc-500 uppercase">{t('notifications.disabled')}</span>}
                  </div>
                  <p className="text-xs text-zinc-500">{t('notifications.covers_monitors').replace('{count}', String(coveredCount(r)))}</p>
                </div>
                {r.canManage && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleRule(r)} className={`relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition-colors ${r.enabled ? 'bg-emerald-500' : 'bg-zinc-700'}`} title={r.enabled ? t('notifications.disable') : t('notifications.enable')}>
                      <span className={`inline-block h-5 w-5 rounded-full bg-white transition ${r.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                    <button onClick={() => setRuleForm({ ...r })} className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400" title={t('notifications.edit')}><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteRule(r)} className="p-2 rounded-xl hover:bg-red-500/10 text-zinc-500 hover:text-red-400" title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <div className="grid sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <div className={labelCls}>{t('notifications.scope')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.allMonitors && <span className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300">{t('notifications.all_monitors')}</span>}
                    {r.groupIds.map((id: string) => <span key={id} className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300">📍 {(groupById.get(id) as any)?.name}</span>)}
                    {r.tagIds.map((id: string) => <span key={id} className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300"># {(tagById.get(id) as any)?.name}</span>)}
                    {r.monitorIds.slice(0, 4).map((id: string) => <span key={id} className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300">{(monitorById.get(id) as any)?.name}</span>)}
                    {r.monitorIds.length > 4 && <span className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-500">+{r.monitorIds.length - 4}</span>}
                  </div>
                </div>
                <div>
                  <div className={labelCls}>{t('notifications.events_label')}</div>
                  <div className="flex flex-wrap gap-1.5">{r.events.map((e: string) => <span key={e} className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300">{eventLabel(e)}</span>)}</div>
                </div>
                <div>
                  <div className={labelCls}>{t('notifications.channels_label')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.channelIds.map((id: string) => {
                      const c: any = channelById.get(id);
                      return <span key={id} className={`px-2 py-1 rounded-lg ${c?.enabled === false ? 'bg-zinc-900 text-zinc-600 line-through' : 'bg-zinc-800 text-zinc-300'}`}>{c ? `${c.name} · ${typeLabel(c.type)}` : '—'}</span>;
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── KANALLAR ── */}
      {tab === 'channels' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">{t('notifications.channels_desc')}</p>
            {canCreate && (
              <button onClick={openNewChannel} className="shrink-0 bg-white text-zinc-950 px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t('notifications.new_channel')}
              </button>
            )}
          </div>
          {data.channels.length === 0 && <div className="py-16 text-center border-2 border-dashed border-zinc-900 rounded-3xl text-zinc-500 text-sm">{t('notifications.no_channels')}</div>}
          <div className="grid md:grid-cols-2 gap-4">
            {data.channels.map((c: any) => (
              <div key={c.id} className={`glass rounded-3xl p-5 border border-white/5 ${c.enabled ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-white truncate">{c.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">{typeLabel(c.type)}</span>
                      <TeamBadge teamId={c.teamId} />
                      {!c.enabled && <span className="text-[10px] font-bold text-zinc-500 uppercase">{t('notifications.disabled')}</span>}
                    </div>
                  </div>
                  {c.canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => testChannel(c)} className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400" title={t('notifications.send_test')}><Send className="w-4 h-4" /></button>
                      <button onClick={() => { const v = c.config?.[CONFIG_FIELD[c.type]] || ''; setChannelForm({ ...c, value: v, originalValue: v }); }} className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400" title={t('notifications.edit')}><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => deleteChannel(c)} className="p-2 rounded-xl hover:bg-red-500/10 text-zinc-500 hover:text-red-400" title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
                {c.canManage && c.config && <p className="text-xs font-mono text-zinc-500 truncate mb-3">{c.config[CONFIG_FIELD[c.type]]}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-500">{t('notifications.used_in_rules').replace('{count}', String(c.ruleCount || 0))}</span>
                  {c.lastTestAt ? (
                    <span className={`inline-flex items-center gap-1 ${c.lastTestOk ? 'text-emerald-400' : 'text-red-400'}`} title={c.lastError || ''}>
                      {c.lastTestOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {c.lastTestOk ? t('notifications.last_test_ok') : t('notifications.last_test_failed')} · {formatDistanceToNow(new Date(c.lastTestAt), { addSuffix: true, locale: dateLocale })}
                    </span>
                  ) : <span className="text-zinc-600">{t('notifications.never_tested')}</span>}
                </div>
                {c.lastTestOk === false && c.lastError && <p className="mt-2 text-[11px] font-mono text-red-400/80 break-words">{c.lastError}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── EKIPLER ── */}
      {tab === 'teams' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">{t('notifications.teams_desc')}</p>
            {actor.isAdmin && (
              <button onClick={() => setTeamForm({ name: '', color: COLORS[data.teams.length % COLORS.length], memberIds: [] })} className="shrink-0 bg-white text-zinc-950 px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t('notifications.new_team')}
              </button>
            )}
          </div>
          {data.teams.length === 0 && <div className="py-16 text-center border-2 border-dashed border-zinc-900 rounded-3xl text-zinc-500 text-sm">{t('notifications.no_teams')}</div>}
          <div className="grid md:grid-cols-2 gap-4">
            {data.teams.map((tm: any) => (
              <div key={tm.id} className="glass rounded-3xl p-5 border border-white/5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tm.color }} />
                    <h3 className="font-bold text-white">{tm.name}</h3>
                  </div>
                  {actor.isAdmin && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setTeamForm({ ...tm })} className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400" title={t('notifications.edit')}><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => deleteTeam(tm)} className="p-2 rounded-xl hover:bg-red-500/10 text-zinc-500 hover:text-red-400" title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tm.memberIds.length === 0 && <span className="text-xs text-zinc-600">{t('notifications.no_members')}</span>}
                  {tm.memberIds.map((uid: string) => {
                    const p: any = personById.get(uid);
                    return <span key={uid} className="px-2 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-300">{p?.name?.trim() || p?.email || uid}</span>;
                  })}
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  {t('notifications.team_counts')
                    .replace('{rules}', String(data.rules.filter((r: any) => r.teamId === tm.id).length))
                    .replace('{channels}', String(data.channels.filter((c: any) => c.teamId === tm.id).length))}
                </p>
              </div>
            ))}
          </div>
          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-500">
            {t('notifications.roles_hint')} <Link to="/settings" className="text-orange-400 font-bold">{t('notifications.go_settings')}</Link>
          </div>
        </section>
      )}

      {/* ── ETIKETLER ── */}
      {tab === 'tags' && (
        <section className="space-y-4">
          <p className="text-sm text-zinc-500">{t('notifications.tags_desc')}</p>
          <form onSubmit={createTag} className="flex gap-2 max-w-md">
            <input className={inputCls} placeholder={t('notifications.tag_name_placeholder')} value={newTag} onChange={e => setNewTag(e.target.value)} maxLength={40} />
            <button type="submit" disabled={!newTag.trim()} className="shrink-0 bg-white text-zinc-950 px-5 rounded-2xl font-bold text-sm disabled:opacity-40">{t('common.create')}</button>
          </form>
          {data.tags.length === 0 && <div className="py-12 text-center border-2 border-dashed border-zinc-900 rounded-3xl text-zinc-500 text-sm">{t('notifications.no_tags')}</div>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.tags.map((tg: any) => (
              <div key={tg.id} className="glass rounded-2xl p-4 border border-white/5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tg.color }} /><span className="font-bold text-white truncate">{tg.name}</span></div>
                  <p className="text-xs text-zinc-500 mt-1">{t('notifications.tag_monitor_count').replace('{count}', String(tg.monitorCount))}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setMonitorSearch(''); setTagMonitors({ ...tg, monitorIds: data.monitors.filter((m: any) => m.tagIds.includes(tg.id)).map((m: any) => m.id) }); }} className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white">{t('notifications.assign_monitors')}</button>
                  {actor.isAdmin && <button onClick={() => deleteTag(tg)} className="p-2 rounded-xl hover:bg-red-500/10 text-zinc-500 hover:text-red-400" title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── GECMIS ── */}
      {tab === 'history' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
              <input type="checkbox" className="accent-orange-500" checked={failedOnly} onChange={e => setFailedOnly(e.target.checked)} /> {t('notifications.failed_only')}
            </label>
            <button onClick={loadLogs} className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> {t('notifications.refresh')}</button>
          </div>
          {logs.length === 0 && <div className="py-16 text-center border-2 border-dashed border-zinc-900 rounded-3xl text-zinc-500 text-sm">{t('notifications.no_history')}</div>}
          <div className="glass rounded-3xl border border-white/5 divide-y divide-white/5 overflow-hidden">
            {logs.map((l: any) => (
              <div key={l.id} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {l.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                <span className="font-bold text-white">{l.subject || '—'}</span>
                <span className="text-xs px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-300">{l.event === 'test' ? t('notifications.event_test') : eventLabel(l.event)}</span>
                <span className="text-xs text-zinc-500">→ {l.channelName || '—'}</span>
                <span className="ml-auto text-xs text-zinc-500" title={format(new Date(l.createdAt), 'd MMM yyyy HH:mm:ss', { locale: dateLocale })}>{formatDistanceToNow(new Date(l.createdAt), { addSuffix: true, locale: dateLocale })}</span>
                {!l.success && l.error && <p className="w-full text-[11px] font-mono text-red-400/80 break-words pl-8">{l.error}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── KURAL FORMU ── */}
      {ruleForm && (
        <Modal title={ruleForm.id ? t('notifications.edit_rule') : t('notifications.new_rule')} onClose={() => setRuleForm(null)} wide>
          <form onSubmit={saveRule} className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('notifications.rule_name')}</label>
                <input required maxLength={100} className={inputCls} placeholder={t('notifications.rule_name_placeholder')} value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>{t('notifications.owner_team')}</label>
                <select className={inputCls} value={ruleForm.teamId || ''} onChange={e => setRuleForm({ ...ruleForm, teamId: e.target.value || null })}>
                  {actor.isAdmin && <option value="">{t('notifications.workspace_wide')}</option>}
                  {assignableTeams.map((tm: any) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>{t('notifications.events_label')}</label>
              <p className="text-[11px] text-zinc-600 mb-2">{t('notifications.monitor_events')}</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {['down', 'degraded', 'up', 'ssl_expiry', 'heartbeat_missed'].map(e => <Chip key={e} active={ruleForm.events.includes(e)} onClick={() => toggleIn('events', e)}>{eventLabel(e)}</Chip>)}
              </div>
              <p className="text-[11px] text-zinc-600 mb-2">{t('notifications.location_events')}</p>
              <div className="flex flex-wrap gap-2">
                {['location_degraded', 'location_down', 'location_up'].map(e => <Chip key={e} active={ruleForm.events.includes(e)} onClick={() => toggleIn('events', e)}>{eventLabel(e)}</Chip>)}
              </div>
              <p className="text-[11px] text-zinc-600 mt-2">{t('notifications.recovery_hint')}</p>
            </div>

            <div>
              <label className={labelCls}>{t('notifications.scope')}</label>
              <label className="inline-flex items-center gap-2 text-sm text-zinc-300 mb-4 cursor-pointer">
                <input type="checkbox" className="accent-orange-500" checked={ruleForm.allMonitors} onChange={e => setRuleForm({ ...ruleForm, allMonitors: e.target.checked })} /> {t('notifications.all_monitors')}
              </label>
              {!ruleForm.allMonitors && (
                <div className="space-y-4">
                  {data.groups.length > 0 && (
                    <div>
                      <p className="text-[11px] text-zinc-600 mb-2">{t('notifications.scope_locations')}</p>
                      <div className="flex flex-wrap gap-2">{data.groups.map((g: any) => <Chip key={g.id} color={g.color} active={ruleForm.groupIds.includes(g.id)} onClick={() => toggleIn('groupIds', g.id)}>{g.name}</Chip>)}</div>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] text-zinc-600 mb-2">{t('notifications.scope_tags')}</p>
                    {data.tags.length === 0
                      ? <p className="text-xs text-zinc-600">{t('notifications.no_tags_short')} <button type="button" className="underline" onClick={() => { setRuleForm(null); setTab('tags'); }}>{t('notifications.go_tags')}</button></p>
                      : <div className="flex flex-wrap gap-2">{data.tags.map((tg: any) => <Chip key={tg.id} color={tg.color} active={ruleForm.tagIds.includes(tg.id)} onClick={() => toggleIn('tagIds', tg.id)}>#{tg.name}</Chip>)}</div>}
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-600 mb-2">{t('notifications.scope_monitors')} {ruleForm.monitorIds.length > 0 && <span className="text-orange-400">({ruleForm.monitorIds.length})</span>}</p>
                    <div className="relative mb-2">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input className={inputCls + ' pl-11'} placeholder={t('dashboard.search_monitors')} value={monitorSearch} onChange={e => setMonitorSearch(e.target.value)} />
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-2xl border border-zinc-800 divide-y divide-zinc-900">
                      {filteredMonitors.map((m: any) => (
                        <label key={m.id} className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 cursor-pointer hover:bg-zinc-900">
                          <input type="checkbox" className="accent-orange-500" checked={ruleForm.monitorIds.includes(m.id)} onChange={() => toggleIn('monitorIds', m.id)} />
                          <span className="truncate">{m.name}</span>
                          {m.groupId && <span className="ml-auto text-[10px] text-zinc-600 shrink-0">{(groupById.get(m.groupId) as any)?.name}</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <p className="text-xs text-zinc-400 mt-3">{t('notifications.covers_monitors').replace('{count}', String(coveredCount(ruleForm)))}</p>
            </div>

            <div>
              <label className={labelCls}>{t('notifications.channels_label')}</label>
              {usableChannels.length === 0
                ? <p className="text-xs text-zinc-500">{t('notifications.need_channel_first')}</p>
                : <div className="flex flex-wrap gap-2">{usableChannels.map((c: any) => <Chip key={c.id} active={ruleForm.channelIds.includes(c.id)} onClick={() => toggleIn('channelIds', c.id)}>{c.name} · {typeLabel(c.type)}</Chip>)}</div>}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setRuleForm(null)} className="flex-1 px-6 py-3.5 rounded-2xl font-bold border border-zinc-800 hover:bg-zinc-800 text-sm">{t('common.cancel')}</button>
              <button type="submit" disabled={saving} className="flex-1 bg-white text-zinc-950 px-6 py-3.5 rounded-2xl font-bold text-sm disabled:opacity-50">{saving ? t('common.processing') : t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── KANAL FORMU ── */}
      {channelForm && (
        <Modal title={channelForm.id ? t('notifications.edit_channel') : t('notifications.new_channel')} onClose={() => setChannelForm(null)}>
          <form onSubmit={saveChannel} className="space-y-5">
            <div>
              <label className={labelCls}>{t('notifications.channel_name')}</label>
              <input required maxLength={80} className={inputCls} placeholder={t('notifications.channel_name_placeholder')} value={channelForm.name} onChange={e => setChannelForm({ ...channelForm, name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>{t('notifications.channel_type')}</label>
              <select disabled={!!channelForm.id} className={inputCls} value={channelForm.type} onChange={e => setChannelForm({ ...channelForm, type: e.target.value, value: '' })}>
                {data.channelTypes.map((ty: string) => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t(`notifications.config_${CONFIG_FIELD[channelForm.type]}`)}</label>
              <input required className={inputCls + ' font-mono'} placeholder={PLACEHOLDER[channelForm.type]} value={channelForm.value} onChange={e => setChannelForm({ ...channelForm, value: e.target.value })} />
              {channelForm.type === 'email' && <p className="text-[11px] text-zinc-600 mt-2">{t('notifications.email_hint')}</p>}
              {channelForm.type === 'telegram' && <p className="text-[11px] text-zinc-600 mt-2">{t('notifications.telegram_hint')}</p>}
            </div>
            <div>
              <label className={labelCls}>{t('notifications.owner_team')}</label>
              <select className={inputCls} value={channelForm.teamId || ''} onChange={e => setChannelForm({ ...channelForm, teamId: e.target.value || null })}>
                {actor.isAdmin && <option value="">{t('notifications.workspace_wide')}</option>}
                {assignableTeams.map((tm: any) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
              </select>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" className="accent-orange-500" checked={channelForm.enabled} onChange={e => setChannelForm({ ...channelForm, enabled: e.target.checked })} /> {t('notifications.channel_enabled')}
            </label>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setChannelForm(null)} className="flex-1 px-6 py-3.5 rounded-2xl font-bold border border-zinc-800 hover:bg-zinc-800 text-sm">{t('common.cancel')}</button>
              <button type="submit" disabled={saving} className="flex-1 bg-white text-zinc-950 px-6 py-3.5 rounded-2xl font-bold text-sm disabled:opacity-50">{saving ? t('common.processing') : t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── EKIP FORMU ── */}
      {teamForm && (
        <Modal title={teamForm.id ? t('notifications.edit_team') : t('notifications.new_team')} onClose={() => setTeamForm(null)}>
          <form onSubmit={saveTeam} className="space-y-5">
            <div>
              <label className={labelCls}>{t('notifications.team_name')}</label>
              <input required maxLength={60} className={inputCls} placeholder={t('notifications.team_name_placeholder')} value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>{t('dashboard.color')}</label>
              <div className="flex gap-2">{COLORS.map(c => <button key={c} type="button" onClick={() => setTeamForm({ ...teamForm, color: c })} className={`w-8 h-8 rounded-full border-2 ${teamForm.color === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />)}</div>
            </div>
            <div>
              <label className={labelCls}>{t('notifications.team_members')}</label>
              <div className="max-h-56 overflow-y-auto rounded-2xl border border-zinc-800 divide-y divide-zinc-900">
                {data.people.map((p: any) => (
                  <label key={p.userId} className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 cursor-pointer hover:bg-zinc-900">
                    <input type="checkbox" className="accent-orange-500" checked={teamForm.memberIds.includes(p.userId)}
                      onChange={() => setTeamForm({ ...teamForm, memberIds: teamForm.memberIds.includes(p.userId) ? teamForm.memberIds.filter((x: string) => x !== p.userId) : [...teamForm.memberIds, p.userId] })} />
                    <span className="truncate">{p.name?.trim() || p.email}</span>
                    <span className="ml-auto text-[10px] text-zinc-600 shrink-0">{t(`notifications.role_${p.role.toLowerCase()}`)}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-zinc-600 mt-2">{t('notifications.team_members_hint')}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setTeamForm(null)} className="flex-1 px-6 py-3.5 rounded-2xl font-bold border border-zinc-800 hover:bg-zinc-800 text-sm">{t('common.cancel')}</button>
              <button type="submit" disabled={saving} className="flex-1 bg-white text-zinc-950 px-6 py-3.5 rounded-2xl font-bold text-sm disabled:opacity-50">{saving ? t('common.processing') : t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── ETIKET -> MONITORLER ── */}
      {tagMonitors && (
        <Modal title={t('notifications.tag_monitors_title').replace('{name}', tagMonitors.name)} onClose={() => setTagMonitors(null)}>
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input className={inputCls + ' pl-11'} placeholder={t('dashboard.search_monitors')} value={monitorSearch} onChange={e => setMonitorSearch(e.target.value)} />
          </div>
          <div className="max-h-80 overflow-y-auto rounded-2xl border border-zinc-800 divide-y divide-zinc-900 mb-5">
            {filteredMonitors.map((m: any) => (
              <label key={m.id} className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 cursor-pointer hover:bg-zinc-900">
                <input type="checkbox" className="accent-orange-500" checked={tagMonitors.monitorIds.includes(m.id)}
                  onChange={() => setTagMonitors({ ...tagMonitors, monitorIds: tagMonitors.monitorIds.includes(m.id) ? tagMonitors.monitorIds.filter((x: string) => x !== m.id) : [...tagMonitors.monitorIds, m.id] })} />
                <span className="truncate">{m.name}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setTagMonitors(null)} className="flex-1 px-6 py-3.5 rounded-2xl font-bold border border-zinc-800 hover:bg-zinc-800 text-sm">{t('common.cancel')}</button>
            <button onClick={saveTagMonitors} disabled={saving} className="flex-1 bg-white text-zinc-950 px-6 py-3.5 rounded-2xl font-bold text-sm disabled:opacity-50">{saving ? t('common.processing') : t('common.save')} ({tagMonitors.monitorIds.length})</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
