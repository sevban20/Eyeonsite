import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CheckCircle2, XCircle, Clock, ChevronRight, Trash2, Pause, Play, Globe, ExternalLink, Activity, Search, Filter, ArrowUpRight, CheckSquare, Square, Lock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import api from '../lib/api';
import { socket } from '../lib/socket';
import { useTranslation } from '../lib/i18n';

interface DashboardProps {
  user: any;
  workspace: any;
}

function MiniAvailabilityHistory({ monitorId }: { monitorId: string }) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const cacheKey = `mini_history_${monitorId}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 1000 * 60 * 60) { // 1 hour cache
            const parsedData = data.map((d: any) => ({ ...d, date: new Date(d.date) }));
            setHistory(parsedData);
            return;
          }
        }

        const res = await api.get(`/monitors/${monitorId}/history`);
        const results = res.data.map((d: any) => ({ ...d, date: new Date(d.date) }));
        setHistory(results);
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: results, timestamp: Date.now() }));
      } catch (err) {
        console.error(err);
      }
    };
    fetchHistory();
  }, [monitorId]);

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
}

export default function Dashboard({ user, workspace }: DashboardProps) {
  const { t } = useTranslation();
  const [monitors, setMonitors] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMonitor, setNewMonitor] = useState({ name: '', monitorType: 'HTTP', url: '', port: '', expectedKeyword: '', customHeaders: '', interval: 60, method: 'GET' });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonitors, setSelectedMonitors] = useState<string[]>([]);

  useEffect(() => {
    if (workspace) {
      const fetchMonitors = async () => {
        try {
          const res = await api.get(`/monitors?workspaceId=${workspace.id}`);
          setMonitors(res.data);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching monitors:', error);
          setLoading(false);
        }
      };
      fetchMonitors();

      // Socket.io listeners
      socket.connect();
      
      const handleMonitorUpdated = (updatedMonitor: any) => {
        if (updatedMonitor.workspaceId === workspace.id) {
          setMonitors(prev => prev.map(m => m.id === updatedMonitor.id ? updatedMonitor : m));
        }
      };

      const handleMonitorCreated = (createdMonitor: any) => {
        if (createdMonitor.workspaceId === workspace.id) {
          setMonitors(prev => [...prev, createdMonitor]);
        }
      };

      const handleMonitorDeleted = (deletedId: string) => {
        setMonitors(prev => prev.filter(m => m.id !== deletedId));
      };

      socket.on('monitor-updated', handleMonitorUpdated);
      socket.on('monitor-created', handleMonitorCreated);
      socket.on('monitor-deleted', handleMonitorDeleted);

      return () => {
        socket.off('monitor-updated', handleMonitorUpdated);
        socket.off('monitor-created', handleMonitorCreated);
        socket.off('monitor-deleted', handleMonitorDeleted);
      };
    }
  }, [workspace]);

  const handleAddMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    
    try {
      await api.post('/monitors', {
        ...newMonitor,
        port: newMonitor.port ? parseInt(newMonitor.port) : null,
        url: newMonitor.url || null,
        workspaceId: workspace.id,
        status: 'up',
        currentStatus: 'up'
      });
      setShowAddModal(false);
      setNewMonitor({ name: '', monitorType: 'HTTP', url: '', port: '', expectedKeyword: '', customHeaders: '', interval: 60, method: 'GET' });
      toast.success('Monitor created successfully');
    } catch (error) {
      console.error('Error adding monitor:', error);
      toast.error('Failed to create monitor');
    }
  };

  const toggleStatus = async (monitor: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const newStatus = monitor.status === 'paused' ? 'up' : 'paused';
    try {
      await api.put(`/monitors/${monitor.id}`, { status: newStatus });
      toast.success(`Monitor ${newStatus === 'paused' ? 'paused' : 'resumed'}`, {
        description: `${monitor.name} is now ${newStatus === 'paused' ? 'paused' : 'active'}.`
      });
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Failed to update monitor status');
    }
  };

  const deleteMonitor = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this monitor?')) {
      try {
        await api.delete(`/monitors/${id}`);
        toast.success('Monitor deleted');
      } catch (error) {
        toast.error('Failed to delete monitor');
      }
    }
  };

  const handleBulkAction = async (action: 'pause' | 'resume' | 'delete') => {
    if (selectedMonitors.length === 0) return;

    if (action === 'delete') {
      if (!window.confirm(`Are you sure you want to delete ${selectedMonitors.length} monitors?`)) {
        return;
      }
    }

    try {
      await api.put('/monitors/bulk/action', { ids: selectedMonitors, action });
      
      toast.success(`Successfully ${action}d ${selectedMonitors.length} monitors`);
      setSelectedMonitors([]);
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      toast.error(`Failed to ${action} monitors`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedMonitors.length === filteredMonitors.length) {
      setSelectedMonitors([]);
    } else {
      setSelectedMonitors(filteredMonitors.map(m => m.id));
    }
  };

  const toggleSelectMonitor = (id: string) => {
    setSelectedMonitors(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  const filteredMonitors = monitors.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const upCount = monitors.filter(m => m.currentStatus === 'up' && m.status !== 'paused').length;
  const degradedCount = monitors.filter(m => m.currentStatus === 'degraded' && m.status !== 'paused').length;
  const downCount = monitors.filter(m => m.currentStatus === 'down' && m.status !== 'paused').length;
  const pausedCount = monitors.filter(m => m.status === 'paused').length;

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
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
        {[
          { label: t('dashboard.operational'), value: upCount, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          { label: t('dashboard.degraded'), value: degradedCount, icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          { label: t('dashboard.outages'), value: downCount, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
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
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">{stat.label}</span>
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
                  title="Resume Selected"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleBulkAction('pause')}
                  className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-orange-400 transition-colors"
                  title="Pause Selected"
                >
                  <Pause className="w-4 h-4" />
                </button>
                <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
                <button 
                  onClick={() => handleBulkAction('delete')}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
                  title="Delete Selected"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            )}
            <button 
              onClick={toggleSelectAll}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors flex items-center gap-2"
              title={selectedMonitors.length === filteredMonitors.length && filteredMonitors.length > 0 ? "Deselect All" : "Select All"}
            >
              {selectedMonitors.length === filteredMonitors.length && filteredMonitors.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-orange-500" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
            <button className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors">
              <Filter className="w-4 h-4" />
            </button>
            <div className="h-8 w-[1px] bg-zinc-800 mx-2" />
            <span className="text-xs text-zinc-500 font-medium">{filteredMonitors.length} results</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredMonitors.map((monitor, i) => (
              <motion.div 
                key={monitor.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className={`group glass p-4 rounded-2xl transition-all card-gradient cursor-pointer ${
                  selectedMonitors.includes(monitor.id) ? 'border-orange-500/50 bg-orange-500/[0.02]' : 'hover:border-zinc-700'
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
                      {selectedMonitors.includes(monitor.id) ? (
                        <CheckSquare className="w-5 h-5 text-orange-500" />
                      ) : (
                        <Square className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                      )}
                    </div>
                    <div className="relative">
                      <div className={`w-3 h-3 rounded-full ${
                        monitor.status === 'paused' ? 'bg-zinc-600' : 
                        monitor.currentStatus === 'up' ? 'bg-emerald-500' : 
                        monitor.currentStatus === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                      }`} />
                      {monitor.status !== 'paused' && (
                        <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${
                          monitor.currentStatus === 'up' ? 'bg-emerald-500' : 
                          monitor.currentStatus === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Link to={`/monitor/${monitor.id}`} className="font-bold text-zinc-100 hover:text-orange-500 transition-colors truncate font-display text-lg">
                          {monitor.name}
                        </Link>
                        <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          monitor.status === 'paused' ? 'bg-zinc-800 text-zinc-500' : 
                          monitor.currentStatus === 'up' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                          monitor.currentStatus === 'degraded' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                          'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                          {monitor.status === 'paused' ? t('dashboard.paused') : monitor.currentStatus === 'up' ? t('dashboard.operational') : monitor.currentStatus === 'degraded' ? t('dashboard.degraded') : t('dashboard.down')}
                        </div>
                        {monitor.monitorType === 'HTTP' && monitor.sslLastChecked && (
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            monitor.sslDaysLeft !== null && monitor.sslDaysLeft <= 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            !monitor.sslValid ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            monitor.sslDaysLeft <= 7 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            monitor.sslDaysLeft <= 30 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`} title="SSL Certificate">
                            <Lock className="w-2.5 h-2.5" />
                            {monitor.sslDaysLeft !== null && monitor.sslDaysLeft <= 0 ? 'EXP' : monitor.sslValid ? (monitor.sslDaysLeft + 'd') : 'ERR'}
                          </div>
                        )}
                        <a href={monitor.url} target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-zinc-400">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-medium">
                        <span className="truncate max-w-[250px] font-mono">{monitor.url}</span>
                        <span className="text-zinc-800">•</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {monitor.interval}s</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <MiniAvailabilityHistory monitorId={monitor.id} />
                    <div className="hidden lg:flex flex-col items-end">
                      <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-1">Last Check</span>
                      <span className="text-[11px] font-medium text-zinc-400">
                        {monitor.lastChecked ? formatDistanceToNow(new Date(monitor.lastChecked), { addSuffix: true }) : 'Never'}
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
                        title={monitor.status === 'paused' ? 'Resume' : 'Pause'}
                      >
                        {monitor.status === 'paused' ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                      </button>
                      <button 
                        onClick={() => deleteMonitor(monitor.id)}
                        className="p-2.5 hover:bg-red-500/10 rounded-xl text-zinc-500 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Link to={`/monitor/${monitor.id}`} className="p-2.5 hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-100 transition-colors">
                        <ArrowUpRight className="w-5 h-5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {filteredMonitors.length === 0 && !loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-20 text-center border-2 border-dashed border-zinc-900 rounded-3xl"
            >
              <Globe className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
              <p className="text-zinc-500 font-medium">No monitors found matching your search.</p>
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
                      placeholder="e.g. Production API"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      value={newMonitor.name}
                      onChange={e => setNewMonitor({...newMonitor, name: e.target.value})}
                    />
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
                          placeholder={newMonitor.monitorType === 'TCP' ? 'e.g. 192.168.1.1' : newMonitor.monitorType === 'PING' ? 'e.g. 8.8.8.8' : 'https://api.example.com'}
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
    </div>
  );
}
