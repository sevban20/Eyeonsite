import React, { useState, useEffect, useMemo, useCallback, useDeferredValue, memo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CheckCircle2, XCircle, Clock, ChevronRight, ChevronDown, Trash2, Pause, Play, Globe, ExternalLink, Activity, Search, Filter, ArrowUpRight, CheckSquare, Square, Lock, FolderPlus, Folder, MoreVertical, Edit2, FolderOpen, Settings2, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import api from '../lib/api';
import { socket, connectSocket } from '../lib/socket';
import { useTranslation } from '../lib/i18n';

interface DashboardProps {
  user: any;
  workspace: any;
}

const MiniAvailabilityHistory = memo(function MiniAvailabilityHistory({ history: rawHistory }: { history?: any[] }) {
  const { t } = useTranslation();
  // Veri artik Dashboard'dan toplu geliyor (/monitors/history-summary).
  const history = (rawHistory || []).map((d: any) => ({ ...d, date: new Date(d.date) }));

  return (
    <div className="hidden sm:flex items-center gap-1 h-6 w-24 mr-4">
      {history.length === 0 ? (
        <div className="w-full h-full bg-zinc-800/50 rounded-sm animate-pulse" />
      ) : (
        history.map((day, i) => {
          let colorClass = 'bg-zinc-800';
          if (day.uptime === 100) colorClass = 'bg-emerald-500';
          else if (day.uptime >= 95) colorClass = 'bg-yellow-500';
          else if (day.uptime >= 0) colorClass = 'bg-red-500';
          
          return (
            <div 
              key={i} 
              className={`flex-1 rounded-sm h-full ${colorClass}`}
              title={`${format(day.date, 'MMM d')}: ${day.uptime === -1 ? t('dashboard.no_data') : day.uptime.toFixed(2) + '%'}`}
            />
          );
        })
      )}
    </div>
  );
});

// 600 kartlik listede her socket guncellemesi tum kartlari yeniden ciziyordu.
// memo + "isSelected" boolean'i (secim dizisinin tamami yerine) sayesinde
// yalnizca degisen kart yeniden cizilir. Kart basina 'layout' animasyonu ve
// giris animasyonu kaldirildi: motion her render'da 600 kartin konumunu olcuyordu.
// content-visibility ekran disindaki kartlarin cizimini tarayiciya erteletir.
// Kartlarda ve basliklarda ortak durum gosterimi. Bakim (maintenance) onceden
// "else" dalina dusup kirmizi "Cokmus" gorunuyordu.
export const monitorStatusView = (monitor: any) => {
  if (monitor.status === 'paused') return { key: 'paused', dot: 'bg-zinc-600', badge: 'bg-zinc-800 text-zinc-500' };
  switch (monitor.currentStatus) {
    case 'up': return { key: 'operational', dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' };
    case 'degraded': return { key: 'degraded', dot: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-500 border border-amber-500/20' };
    case 'maintenance': return { key: 'maintenance', dot: 'bg-blue-500', badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' };
    default: return { key: 'down', dot: 'bg-red-500', badge: 'bg-red-500/10 text-red-500 border border-red-500/20' };
  }
};

const MonitorCard = memo(function MonitorCard({ monitor, history, isSelected, toggleSelectMonitor, toggleStatus, deleteMonitor }: any) {
  const { t, language } = useTranslation();
  const view = monitorStatusView(monitor);
  const isHttps = monitor.monitorType === 'HTTP' && typeof monitor.url === 'string' && monitor.url.toLowerCase().startsWith('https://');
  return (
    <div
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 88px' } as React.CSSProperties}
      className={`group glass p-4 rounded-2xl transition-colors card-gradient cursor-pointer ${
        isSelected ? 'border-orange-500/50 bg-orange-500/[0.02]' : 'hover:border-zinc-700'
      }`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
          return;
        }
        toggleSelectMonitor(monitor.id);
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center justify-center w-6 h-6">
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-orange-500" />
            ) : (
              <Square className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            )}
          </div>
          <div className="relative">
            <div className={`w-3 h-3 rounded-full ${view.dot}`} />
            {/* Surekli "ping" animasyonu yalnizca sorunlu monitorlerde: 600
                kartta 600 sonsuz animasyon tarayiciyi surekli yeniden ciziyordu. */}
            {(view.key === 'down' || view.key === 'degraded') && (
              <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${view.dot}`} />
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1">
              <Link to={`/monitor/${monitor.id}`} className="font-bold text-zinc-100 hover:text-orange-500 transition-colors truncate font-display text-lg">
                {monitor.name}
              </Link>
              <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${view.badge}`}>
                {t(`dashboard.${view.key}`)}
              </div>
              {isHttps && monitor.sslLastChecked && (
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                  monitor.sslDaysLeft !== null && monitor.sslDaysLeft <= 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  !monitor.sslValid ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  monitor.sslDaysLeft <= 7 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  monitor.sslDaysLeft <= 30 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`} title={t('dashboard.ssl_certificate')}>
                  <Lock className="w-2.5 h-2.5" />
                  {monitor.sslDaysLeft !== null && monitor.sslDaysLeft <= 0 ? 'EXP' : monitor.sslValid ? (monitor.sslDaysLeft + 'd') : 'ERR'}
                </div>
              )}
              {monitor.monitorType === 'HTTP' && monitor.url && (
                <a href={monitor.url} target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-zinc-400">
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            {/* HEARTBEAT monitorlerinin url'i yoktur; adres ve ayiriciyi
                gostermek bos bir "•" birakiyordu. */}
            <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-medium">
              {monitor.url && (
                <>
                  <span className="truncate max-w-[250px] font-mono">{monitor.url}</span>
                  <span className="text-zinc-800">•</span>
                </>
              )}
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {monitor.interval}s</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <MiniAvailabilityHistory history={history} />
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-1">{t('dashboard.last_check')}</span>
            <span className="text-[11px] font-medium text-zinc-400">
              {monitor.lastChecked ? formatDistanceToNow(new Date(monitor.lastChecked), { addSuffix: true, locale: language === 'tr' ? trLocale : undefined }) : t('dashboard.never')}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={(e) => toggleStatus(monitor, e)}
              className={`p-2.5 rounded-xl transition-colors ${
                monitor.status === 'paused' 
                  ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700' 
                  : 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-100'
              }`}
              title={monitor.status === 'paused' ? t('dashboard.resume') : t('dashboard.pause')}
            >
              {monitor.status === 'paused' ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            </button>
            <button 
              onClick={() => deleteMonitor(monitor.id)}
              className="p-2.5 hover:bg-red-500/10 rounded-xl text-zinc-500 hover:text-red-500 transition-colors"
              title={t('common.delete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <Link to={`/monitor/${monitor.id}`} className="p-2.5 hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-100 transition-colors">
              <ArrowUpRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function Dashboard({ user, workspace }: DashboardProps) {
  const { t } = useTranslation();
  const [monitors, setMonitors] = useState<any[]>([]);
  const [monitorGroups, setMonitorGroups] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newMonitor, setNewMonitor] = useState({ name: '', monitorType: 'HTTP', url: '', port: '', expectedKeyword: '', customHeaders: '', acceptedStatusCodes: '', interval: 60, method: 'GET', groupId: '' });
  const [newGroup, setNewGroup] = useState({ name: '', color: '#f97316' });
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  // Faz 3.5: lokasyon (composite) alarm ayarlari duzenlenen grup
  const [compositeSettings, setCompositeSettings] = useState<any | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonitors, setSelectedMonitors] = useState<string[]>([]);
  const [historyMap, setHistoryMap] = useState<Record<string, any[]>>({});
  const [groupDropdownOpen, setGroupDropdownOpen] = useState<string | null>(null);

  useEffect(() => {
    if (workspace) {
      const fetchMonitors = async () => {
        try {
          const [monitorsRes, groupsRes] = await Promise.all([
            api.get(`/monitors?workspaceId=${workspace.id}`),
            api.get(`/monitor-groups?workspaceId=${workspace.id}`)
          ]);
          setMonitors(monitorsRes.data);
          setMonitorGroups(groupsRes.data);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching data:', error);
          setLoading(false);
        }
      };
      fetchMonitors();

      // 7 gunluk mini gecmis: tum monitorlar icin TEK istek (5 dk onbellekli)
      const fetchHistorySummary = async () => {
        const cacheKey = `mini_history_ws_${workspace.id}`;
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 5 * 60 * 1000) { setHistoryMap(data); return; }
          }
        } catch { /* bozuk/erisilemeyen onbellek: yeniden cek */ }
        try {
          const res = await api.get(`/monitors/history-summary?workspaceId=${workspace.id}`);
          setHistoryMap(res.data);
          try { sessionStorage.setItem(cacheKey, JSON.stringify({ data: res.data, timestamp: Date.now() })); } catch { /* kota dolu */ }
        } catch (err) {
          console.error('Error fetching history summary:', err);
        }
      };
      fetchHistorySummary();

      // Socket.io listeners (authenticated — joins the workspace room)
      connectSocket(workspace.id);
      
      // Sunucu guncellemeleri ~1 sn'lik paketler halinde yollar: paket basina
      // TEK state guncellemesi (eskiden monitor basina bir render vardi).
      const handleMonitorsUpdated = (batch: any[]) => {
        const updates = new Map<string, any>();
        for (const m of batch) if (m.workspaceId === workspace.id) updates.set(m.id, m);
        if (updates.size === 0) return;
        setMonitors(prev => prev.map(m => updates.get(m.id) || m));
      };

      const handleMonitorCreated = (createdMonitor: any) => {
        if (createdMonitor.workspaceId === workspace.id) {
          // Olusturma yaniti zaten ekliyor; socket olayi ikinci kopya yaratmasin.
          setMonitors(prev => prev.some(m => m.id === createdMonitor.id) ? prev : [...prev, createdMonitor]);
        }
      };

      const handleMonitorDeleted = (deletedId: string) => {
        setMonitors(prev => prev.filter(m => m.id !== deletedId));
      };

      socket.on('monitors-updated', handleMonitorsUpdated);
      socket.on('monitor-created', handleMonitorCreated);
      socket.on('monitor-deleted', handleMonitorDeleted);

      return () => {
        socket.off('monitors-updated', handleMonitorsUpdated);
        socket.off('monitor-created', handleMonitorCreated);
        socket.off('monitor-deleted', handleMonitorDeleted);
      };
    }
  }, [workspace]);

  const handleAddMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    
    try {
      const payload: any = {
        ...newMonitor,
        port: newMonitor.port ? parseInt(newMonitor.port as any) : null,
        url: newMonitor.url || null,
        workspaceId: workspace.id,
        status: 'up',
        currentStatus: 'up'
      };
      if (payload.groupId === '') {
        delete payload.groupId;
      }

      const res = await api.post('/monitors', payload);
      // Liste yalnizca socket olayina guvenmesin (baglanti yoksa monitor gorunmuyordu).
      setMonitors(prev => prev.some(m => m.id === res.data.id) ? prev : [...prev, res.data]);
      setShowAddModal(false);
      setNewMonitor({ name: '', monitorType: 'HTTP', url: '', port: '', expectedKeyword: '', customHeaders: '', acceptedStatusCodes: '', interval: 60, method: 'GET', groupId: '' });
      toast.success(t('dashboard.toast_monitor_created'));
    } catch (error: any) {
      console.error('Error adding monitor:', error);
      toast.error(error?.response?.data?.error || t('dashboard.toast_monitor_create_failed'));
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    
    try {
      const res = await api.post('/monitor-groups', {
        ...newGroup,
        workspaceId: workspace.id
      });
      setMonitorGroups([...monitorGroups, res.data]);
      setShowGroupModal(false);
      setNewGroup({ name: '', color: '#f97316' });
      toast.success(t('dashboard.toast_group_created'));
    } catch (error) {
      console.error('Error adding group:', error);
      toast.error(t('dashboard.toast_group_create_failed'));
    }
  };

  // Basariyi doner: lokasyon ayarlari kaydi hata alinca "kaydedildi" deyip
  // modali kapatiyordu, cunku hata burada yutuluyordu.
  const handleUpdateGroup = async (id: string, updates: any): Promise<boolean> => {
    try {
      const res = await api.put(`/monitor-groups/${id}`, updates);
      setMonitorGroups(prev => prev.map(g => g.id === id ? res.data : g));
      if (updates.name) {
        toast.success(t('dashboard.toast_group_renamed'));
      }
      return true;
    } catch (error: any) {
      console.error('Error updating group:', error);
      toast.error(error?.response?.data?.error || t('dashboard.toast_group_update_failed'));
      return false;
    }
  };

  // Kanallar sunucuda JSON string olarak tutuluyor; formda nesne olarak
  // calisip kaydederken nesne gonderiyoruz (sema stringe cevirir).
  const parseChannels = (raw: any) => {
    if (!raw) return {};
    try { return typeof raw === 'string' ? (JSON.parse(raw) || {}) : raw; } catch { return {}; }
  };

  const openCompositeSettings = (group: any) => {
    setCompositeSettings({
      id: group.id,
      name: group.name,
      compositeEnabled: !!group.compositeEnabled,
      degradedThreshold: group.degradedThreshold || 1,
      suppressMemberAlerts: !!group.suppressMemberAlerts,
      degradedChannels: parseChannels(group.degradedChannels),
      downChannels: parseChannels(group.downChannels)
    });
  };

  const handleSaveCompositeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compositeSettings) return;
    // Bos stringleri gondermiyoruz: sema url/email dogrulamasi yapiyor ve
    // "kanal tanimli degil" ile "bos string" ayrimini korumak istiyoruz.
    const clean = (obj: any) => Object.fromEntries(
      Object.entries(obj || {}).filter(([, v]) => typeof v === 'string' && v.trim() !== '')
    );
    try {
      const ok = await handleUpdateGroup(compositeSettings.id, {
        compositeEnabled: compositeSettings.compositeEnabled,
        degradedThreshold: Number(compositeSettings.degradedThreshold) || 1,
        suppressMemberAlerts: compositeSettings.suppressMemberAlerts,
        degradedChannels: clean(compositeSettings.degradedChannels),
        downChannels: clean(compositeSettings.downChannels)
      });
      if (!ok) return;
      toast.success(t('dashboard.composite_saved'));
      setCompositeSettings(null);
    } catch {
      // handleUpdateGroup zaten hatayi bildiriyor
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (window.confirm(t('dashboard.confirm_delete_group'))) {
      try {
        await api.delete(`/monitor-groups/${id}`);
        setMonitorGroups(prev => prev.filter(g => g.id !== id));
        setMonitors(prev => prev.map(m => m.groupId === id ? { ...m, groupId: null } : m));
        toast.success(t('dashboard.toast_group_deleted'));
      } catch (error) {
        toast.error(t('dashboard.toast_group_delete_failed'));
      }
    }
  };

  const moveMonitorToGroup = async (monitorId: string, groupId: string | null) => {
    try {
      const res = await api.put(`/monitors/${monitorId}`, { groupId });
      setMonitors(prev => prev.map(m => m.id === monitorId ? res.data : m));
      toast.success(t('dashboard.toast_monitor_moved'));
      setGroupDropdownOpen(null);
    } catch (error) {
      toast.error(t('dashboard.toast_move_failed'));
    }
  };

  const moveSelectedMonitorsToGroup = async (groupId: string | null) => {
    if (selectedMonitors.length === 0) return;
    try {
      await api.put('/monitors/bulk/action', { ids: selectedMonitors, action: 'move', groupId });
      setMonitors(prev => prev.map(m => selectedMonitors.includes(m.id) ? { ...m, groupId } : m));
      toast.success(t('dashboard.toast_monitors_moved').replace('{count}', String(selectedMonitors.length)));
      setSelectedMonitors([]);
    } catch (error) {
      toast.error(t('dashboard.toast_move_failed'));
    }
  };

  const toggleStatus = useCallback(async (monitor: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const newStatus = monitor.status === 'paused' ? 'up' : 'paused';
    try {
      const res = await api.put(`/monitors/${monitor.id}`, { status: newStatus });
      setMonitors(prev => prev.map(m => m.id === monitor.id ? res.data : m));
      toast.success(newStatus === 'paused' ? t('dashboard.toast_paused') : t('dashboard.toast_resumed'), { description: monitor.name });
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error(t('dashboard.toast_status_failed'));
    }
  }, [t]);

  const deleteMonitor = useCallback(async (id: string) => {
    if (window.confirm(t('dashboard.confirm_delete_monitor'))) {
      try {
        await api.delete(`/monitors/${id}`);
        setMonitors(prev => prev.filter(m => m.id !== id));
        toast.success(t('dashboard.toast_monitor_deleted'));
      } catch (error) {
        toast.error(t('dashboard.toast_monitor_delete_failed'));
      }
    }
  }, [t]);

  const handleBulkAction = async (action: 'pause' | 'resume' | 'delete') => {
    if (selectedMonitors.length === 0) return;

    if (action === 'delete') {
      if (!window.confirm(t('dashboard.confirm_bulk_delete').replace('{count}', String(selectedMonitors.length)))) {
        return;
      }
    }

    try {
      await api.put('/monitors/bulk/action', { ids: selectedMonitors, action });
      
      toast.success(t(`dashboard.toast_bulk_${action}`).replace('{count}', String(selectedMonitors.length)));
      setSelectedMonitors([]);
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      toast.error(t('dashboard.toast_bulk_failed'));
    }
  };

  const toggleSelectAll = () => {
    if (selectedMonitors.length === filteredMonitors.length) {
      setSelectedMonitors([]);
    } else {
      setSelectedMonitors(filteredMonitors.map(m => m.id));
    }
  };

  const toggleSelectMonitor = useCallback((id: string) => {
    setSelectedMonitors(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  }, []);

  // Arama kutusuna yazarken liste filtrelemesi yazmayi bloklamasin.
  const deferredQuery = useDeferredValue(searchQuery);
  // url HEARTBEAT monitorlerinde null: eskiden aramada sayfa cokuyordu.
  const filteredMonitors = useMemo(() => {
    const q = deferredQuery.toLowerCase();
    if (!q) return monitors;
    return monitors.filter(m =>
      (m.name || '').toLowerCase().includes(q) || (m.url || '').toLowerCase().includes(q)
    );
  }, [monitors, deferredQuery]);

  // Grup basina monitorler tek geciste (eskiden her grup icin tum liste filtreleniyordu).
  const monitorsByGroup = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const m of filteredMonitors) {
      const key = m.groupId || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [filteredMonitors]);

  const selectedSet = useMemo(() => new Set(selectedMonitors), [selectedMonitors]);

  const { upCount, degradedCount, downCount, pausedCount, maintenanceCount } = useMemo(() => {
    let upCount = 0, degradedCount = 0, downCount = 0, pausedCount = 0, maintenanceCount = 0;
    for (const m of monitors) {
      if (m.status === 'paused') { pausedCount++; continue; }
      if (m.currentStatus === 'up') upCount++;
      else if (m.currentStatus === 'degraded') degradedCount++;
      else if (m.currentStatus === 'maintenance') maintenanceCount++;
      else downCount++;
    }
    return { upCount, degradedCount, downCount, pausedCount, maintenanceCount };
  }, [monitors]);

  // Arama degisince secim temizlenir: aksi halde ekranda gorunmeyen secili
  // monitorler toplu silme/duraklatmaya dahil oluyordu.
  useEffect(() => { setSelectedMonitors([]); }, [deferredQuery]);

  return (
    <div className="max-w-7xl mx-auto px-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-orange-500 font-bold text-xs uppercase tracking-[0.2em] mb-3"
          >
            <Activity className="w-4 h-4" />
            {t('dashboard.system_overview')}
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl font-bold tracking-tight text-white mb-2 font-display"
          >
            {t('dashboard.title')}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-500 text-lg"
          >
            {t('dashboard.monitoring_services').replace('{count}', String(monitors.length))}
          </motion.p>
        </div>
        
        <div className="flex gap-2">
          <motion.button 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowGroupModal(true)}
            className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-4 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all hover:bg-zinc-800"
          >
            <FolderPlus className="w-5 h-5" />
            <span className="hidden sm:inline">{t('dashboard.new_group')}</span>
          </motion.button>
          <motion.button 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="bg-white text-zinc-950 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-xl shadow-white/5"
          >
            <Plus className="w-5 h-5" />
            {t('dashboard.add_monitor')}
          </motion.button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
        {[
          { label: t('dashboard.operational'), value: upCount, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          { label: t('dashboard.degraded'), value: degradedCount, icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          { label: t('dashboard.outages'), value: downCount, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
          { label: t('dashboard.maintenance'), value: maintenanceCount, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { label: t('dashboard.paused'), value: pausedCount, icon: Pause, color: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' }
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + (i * 0.1) }}
            className={`glass p-6 rounded-3xl ${stat.border} relative overflow-hidden group`}
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <stat.icon className="w-16 h-16" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <span className="text-zinc-400 text-[10px] sm:text-xs font-bold uppercase tracking-wide sm:tracking-widest leading-tight min-w-0">{stat.label}</span>
            </div>
            <div className="text-4xl font-bold text-white font-display">{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Controls & List */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder={t('dashboard.search_monitors')}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            {selectedMonitors.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 mr-4 bg-zinc-900 border border-zinc-800 rounded-xl p-1"
              >
                <span className="text-xs font-bold text-zinc-400 px-3">{selectedMonitors.length} {t('dashboard.selected')}</span>
                <button 
                  onClick={() => handleBulkAction('resume')}
                  className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-emerald-400 transition-colors"
                  title={t('dashboard.resume_selected')}
                >
                  <Play className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleBulkAction('pause')}
                  className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-orange-400 transition-colors"
                  title={t('dashboard.pause_selected')}
                >
                  <Pause className="w-4 h-4" />
                </button>
                <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
                <button 
                  onClick={() => handleBulkAction('delete')}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
                  title={t('dashboard.delete_selected')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            )}
            <button 
              onClick={toggleSelectAll}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors flex items-center gap-2"
              title={selectedMonitors.length === filteredMonitors.length && filteredMonitors.length > 0 ? t('dashboard.deselect_all') : t('dashboard.select_all')}
            >
              {selectedMonitors.length === filteredMonitors.length && filteredMonitors.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-orange-500" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
            <button 
              onClick={() => setGroupDropdownOpen(groupDropdownOpen === 'bulk' ? null : 'bulk')}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors flex items-center gap-2 relative"
            >
              <FolderOpen className="w-4 h-4" />
              {groupDropdownOpen === 'bulk' && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 py-1" onClick={(e) => e.stopPropagation()}>
                  <div className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">{t('dashboard.move_to')}</div>
                  <button
                    onClick={() => { moveSelectedMonitorsToGroup(null); setGroupDropdownOpen(null); }}
                    className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                  >
                    <Folder className="w-4 h-4 text-zinc-500" />
                    Ungrouped
                  </button>
                  {monitorGroups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => { moveSelectedMonitorsToGroup(g.id); setGroupDropdownOpen(null); }}
                      className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </button>
            <div className="h-8 w-[1px] bg-zinc-800 mx-2" />
            <span className="text-xs text-zinc-500 font-medium">{t('dashboard.results').replace('{count}', String(filteredMonitors.length))}</span>
          </div>
        </div>

        <div className="space-y-6">
          {/* Render Groups */}
          {monitorGroups.map(group => {
            const groupMonitors = monitorsByGroup.get(group.id) || [];
            if (groupMonitors.length === 0 && searchQuery) return null;

            return (
              <div key={group.id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl overflow-hidden">
                <div 
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
                    handleUpdateGroup(group.id, { collapsed: !group.collapsed });
                  }}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleUpdateGroup(group.id, { collapsed: !group.collapsed })}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                      aria-label={group.collapsed ? t('dashboard.expand_group') : t('dashboard.collapse_group')}
                    >
                      {group.collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                    
                    {editingGroupId === group.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingGroupName}
                        onChange={e => setEditingGroupName(e.target.value)}
                        onBlur={() => {
                          if (editingGroupName.trim() && editingGroupName !== group.name) {
                            handleUpdateGroup(group.id, { name: editingGroupName.trim() });
                          }
                          setEditingGroupId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (editingGroupName.trim() && editingGroupName !== group.name) {
                              handleUpdateGroup(group.id, { name: editingGroupName.trim() });
                            }
                            setEditingGroupId(null);
                          }
                          if (e.key === 'Escape') setEditingGroupId(null);
                        }}
                        className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-orange-500"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <h3 
                        className="text-lg font-bold text-white font-display onDoubleClick"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingGroupId(group.id);
                          setEditingGroupName(group.name);
                        }}
                      >
                        {group.name}
                      </h3>
                    )}
                    <span className="text-xs font-bold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{groupMonitors.length}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {group.compositeEnabled && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                          group.compositeStatus === 'down'
                            ? 'bg-red-500/10 text-red-500'
                            : group.compositeStatus === 'degraded'
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-emerald-500/10 text-emerald-500'
                        }`}
                        title={t('dashboard.composite_badge_title')}
                      >
                        {t(`dashboard.composite_status_${group.compositeStatus || 'up'}`)}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); openCompositeSettings(group); }}
                      className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors"
                      title={t('dashboard.composite_title')}
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-500 transition-colors"
                      title={t('dashboard.delete_group')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {!group.collapsed && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 pt-0 grid grid-cols-1 gap-3">
                        {groupMonitors.map((monitor, i) => (
                          <MonitorCard 
                            key={monitor.id} 
                            monitor={monitor} 
                            history={historyMap[monitor.id]}
                            isSelected={selectedSet.has(monitor.id)}
                            toggleSelectMonitor={toggleSelectMonitor}
                            toggleStatus={toggleStatus}
                            deleteMonitor={deleteMonitor}
                          />
                        ))}
                        {groupMonitors.length === 0 && (
                          <div className="text-center py-8 text-zinc-500 text-sm border-2 border-dashed border-zinc-800 rounded-2xl mx-2 mb-2">
                            No monitors in this group
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Ungrouped Monitors */}
          {(() => {
            const ungroupedMonitors = monitorsByGroup.get('') || [];
            if (ungroupedMonitors.length === 0) return null;

            return (
              <div className="bg-zinc-900/30 border border-zinc-800/30 rounded-3xl overflow-hidden">
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Folder className="w-5 h-5 text-zinc-500" />
                    <h3 className="text-lg font-bold text-zinc-300 font-display">{t('dashboard.ungrouped')}</h3>
                    <span className="text-xs font-bold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{ungroupedMonitors.length}</span>
                  </div>
                </div>
                <div className="p-4 pt-0 grid grid-cols-1 gap-3">
                  {ungroupedMonitors.map((monitor, i) => (
                    <MonitorCard 
                      key={monitor.id} 
                      monitor={monitor} 
                      history={historyMap[monitor.id]}
                      isSelected={selectedSet.has(monitor.id)}
                      toggleSelectMonitor={toggleSelectMonitor}
                      toggleStatus={toggleStatus}
                      deleteMonitor={deleteMonitor}
                    />
                  ))}
                </div>
              </div>
            );
          })()}

          
          {filteredMonitors.length === 0 && !loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-20 text-center border-2 border-dashed border-zinc-900 rounded-3xl"
            >
              <Globe className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
              <p className="text-zinc-500 font-medium">{searchQuery ? t('dashboard.no_search_results') : t('dashboard.empty_state')}</p>
              {!searchQuery && (
                <button onClick={() => setShowAddModal(true)} className="mt-6 bg-white text-zinc-950 px-6 py-3 rounded-2xl font-bold inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> {t('dashboard.add_monitor')}
                </button>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Add Monitor Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative z-10"
            >
              <h2 className="text-3xl font-bold mb-2 font-display">{t('dashboard.new_monitor')}</h2>
              <p className="text-zinc-500 text-sm mb-8">{t('dashboard.add_first_desc')}</p>
              
              <form onSubmit={handleAddMonitor} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{t('dashboard.friendly_name')}</label>
                    <input 
                      type="text" 
                      required
                      placeholder={t('dashboard.name_placeholder')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      value={newMonitor.name}
                      onChange={e => setNewMonitor({...newMonitor, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{t('dashboard.group')}</label>
                    <select 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm appearance-none"
                      value={newMonitor.groupId || ''}
                      onChange={e => setNewMonitor({...newMonitor, groupId: e.target.value})}
                    >
                      <option value="">{t('dashboard.no_group')}</option>
                      {monitorGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{t('dashboard.monitor_type')}</label>
                    <select 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm appearance-none"
                      value={newMonitor.monitorType}
                      onChange={e => setNewMonitor({...newMonitor, monitorType: e.target.value})}
                    >
                      <option value="HTTP">{t('dashboard.type_http')}</option>
                      <option value="TCP">{t('dashboard.type_tcp')}</option>
                      <option value="PING">{t('dashboard.type_ping')}</option>
                      <option value="HEARTBEAT">{t('dashboard.type_heartbeat')}</option>
                    </select>
                  </div>

                  {newMonitor.monitorType !== 'HEARTBEAT' && (
                    <div className={newMonitor.monitorType === 'TCP' ? 'grid grid-cols-3 gap-4' : ''}>
                      <div className={newMonitor.monitorType === 'TCP' ? 'col-span-2' : ''}>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">
                          {['TCP', 'PING'].includes(newMonitor.monitorType) ? t('dashboard.host_ip') : t('dashboard.monitor_url')}
                        </label>
                        <input 
                          type={newMonitor.monitorType === 'HTTP' ? 'url' : 'text'} 
                          required={newMonitor.monitorType !== 'HEARTBEAT'}
                          placeholder={newMonitor.monitorType === 'TCP' ? 'db.example.com' : newMonitor.monitorType === 'PING' ? 'e.g. 8.8.8.8' : 'https://api.example.com'}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                          value={newMonitor.url}
                          onChange={e => setNewMonitor({...newMonitor, url: e.target.value})}
                        />
                      </div>
                      {newMonitor.monitorType === 'TCP' && (
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{t('dashboard.port')}</label>
                          <input 
                            type="number" 
                            required
                            placeholder="5432"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                            value={newMonitor.port}
                            onChange={e => setNewMonitor({...newMonitor, port: e.target.value})}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {newMonitor.monitorType === 'HEARTBEAT' && (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                      <p className="text-xs text-blue-400 font-medium leading-relaxed">
                        {t('dashboard.heartbeat_desc')}
                      </p>
                    </div>
                  )}

                  {newMonitor.monitorType === 'HTTP' && (
                    <div className="space-y-4 pt-2 border-t border-zinc-800/50">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{t('dashboard.expected_keyword')}</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 'Welcome' or '{&quot;status&quot;:&quot;ok&quot;}'"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                          value={newMonitor.expectedKeyword}
                          onChange={e => setNewMonitor({...newMonitor, expectedKeyword: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{t('monitor.accepted_status_codes')}</label>
                        <input
                          type="text"
                          placeholder="200-299,404"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-mono"
                          value={newMonitor.acceptedStatusCodes}
                          onChange={e => setNewMonitor({...newMonitor, acceptedStatusCodes: e.target.value})}
                        />
                        <p className="text-xs text-zinc-500 mt-2 ml-1">{t('monitor.accepted_status_codes_desc')}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{t('dashboard.custom_headers')}</label>
                        <textarea 
                          placeholder='{"Authorization": "Bearer token..."}'
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-mono min-h-[80px]"
                          value={newMonitor.customHeaders}
                          onChange={e => setNewMonitor({...newMonitor, customHeaders: e.target.value})}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{t('dashboard.interval')}</label>
                      <select 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm appearance-none"
                        value={newMonitor.interval}
                        onChange={e => setNewMonitor({...newMonitor, interval: parseInt(e.target.value)})}
                      >
                        <option value={10}>10 {t('dashboard.interval_unit_secs') || 'Seconds'}</option>
                        <option value={30}>30 {t('dashboard.interval_unit_secs') || 'Seconds'}</option>
                        <option value={60}>1 {t('dashboard.interval_unit_min') || 'Minute'}</option>
                        <option value={300}>5 {t('dashboard.interval_unit_mins') || 'Minutes'}</option>
                        <option value={600}>10 {t('dashboard.interval_unit_mins') || 'Minutes'}</option>
                        <option value={1800}>30 {t('dashboard.interval_unit_mins') || 'Minutes'}</option>
                      </select>
                    </div>
                    {newMonitor.monitorType === 'HTTP' && (
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{t('dashboard.method')}</label>
                        <select 
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm appearance-none"
                          value={newMonitor.method}
                          onChange={e => setNewMonitor({...newMonitor, method: e.target.value})}
                        >
                          <option value="GET">GET</option>
                          <option value="HEAD">HEAD</option>
                          <option value="POST">POST</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold border border-zinc-800 hover:bg-zinc-800 transition-colors text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-white text-zinc-950 px-6 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-white/5 text-sm"
                  >
                    {t('dashboard.create_monitor')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Group Modal */}
      <AnimatePresence>
        {/* composite_modal_marker — Faz 3.5: lokasyon alarm ayarlari */}
        {compositeSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCompositeSettings(null)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl relative z-10 max-h-[85vh] overflow-y-auto"
            >
              <h2 className="text-3xl font-bold mb-2 font-display">{t('dashboard.composite_title')}</h2>
              <p className="text-sm text-zinc-500 mb-8">{compositeSettings.name} — {t('dashboard.composite_desc')}</p>

              <form onSubmit={handleSaveCompositeSettings} className="space-y-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 accent-orange-500 w-4 h-4"
                    checked={compositeSettings.compositeEnabled}
                    onChange={e => setCompositeSettings({ ...compositeSettings, compositeEnabled: e.target.checked })}
                  />
                  <span>
                    <span className="text-sm font-bold">{t('dashboard.composite_enable')}</span>
                    <span className="block text-xs text-zinc-500 mt-1">{t('dashboard.composite_enable_desc')}</span>
                  </span>
                </label>

                {compositeSettings.compositeEnabled && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">
                        {t('dashboard.composite_threshold')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                        value={compositeSettings.degradedThreshold}
                        onChange={e => setCompositeSettings({ ...compositeSettings, degradedThreshold: e.target.value })}
                      />
                      <p className="text-xs text-zinc-500 mt-2 ml-1">{t('dashboard.composite_threshold_desc')}</p>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 accent-orange-500 w-4 h-4"
                        checked={compositeSettings.suppressMemberAlerts}
                        onChange={e => setCompositeSettings({ ...compositeSettings, suppressMemberAlerts: e.target.checked })}
                      />
                      <span>
                        <span className="text-sm font-bold">{t('dashboard.composite_suppress')}</span>
                        <span className="block text-xs text-zinc-500 mt-1">{t('dashboard.composite_suppress_desc')}</span>
                      </span>
                    </label>

                    {(['degradedChannels', 'downChannels'] as const).map(setKey => (
                      <div key={setKey} className="border border-zinc-800 rounded-3xl p-6">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className={`w-4 h-4 ${setKey === 'downChannels' ? 'text-red-500' : 'text-amber-500'}`} />
                          <h3 className="text-sm font-bold">
                            {setKey === 'downChannels' ? t('dashboard.composite_down_title') : t('dashboard.composite_degraded_title')}
                          </h3>
                        </div>
                        <p className="text-xs text-zinc-500 mb-5">
                          {setKey === 'downChannels' ? t('dashboard.composite_down_desc') : t('dashboard.composite_degraded_desc')}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {([
                            ['alertEmail', 'Email', 'email'],
                            ['telegramChatId', 'Telegram Chat ID', 'text'],
                            ['slackWebhook', 'Slack Webhook', 'url'],
                            ['discordWebhook', 'Discord Webhook', 'url'],
                            ['teamsWebhook', 'Teams Webhook', 'url'],
                            ['zoomWebhook', 'Zoom Webhook', 'url'],
                            ['genericWebhook', 'Generic Webhook', 'url']
                          ] as const).map(([field, label, type]) => (
                            <div key={field}>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{label}</label>
                              <input
                                type={type}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                                value={compositeSettings[setKey]?.[field] || ''}
                                onChange={e => setCompositeSettings({
                                  ...compositeSettings,
                                  [setKey]: { ...compositeSettings[setKey], [field]: e.target.value }
                                })}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setCompositeSettings(null)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold border border-zinc-800 hover:bg-zinc-800 transition-colors text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-white text-zinc-950 px-6 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-white/5 text-sm"
                  >
                    {t('common.save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showGroupModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGroupModal(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl relative z-10"
            >
              <h2 className="text-3xl font-bold mb-8 font-display">{t('dashboard.new_group')}</h2>
              
              <form onSubmit={handleAddGroup} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{t('dashboard.group_name')}</label>
                  <input 
                    type="text" 
                    required
                    placeholder={t('dashboard.group_name_placeholder')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                    value={newGroup.name}
                    onChange={e => setNewGroup({...newGroup, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{t('dashboard.color')}</label>
                  <div className="flex gap-2 flex-wrap">
                    {['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#ef4444', '#eab308'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewGroup({...newGroup, color})}
                        className={`w-10 h-10 rounded-full border-2 transition-transform ${newGroup.color === color ? 'scale-110 border-white' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowGroupModal(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold border border-zinc-800 hover:bg-zinc-800 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-white text-zinc-950 px-6 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-white/5 text-sm"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
