import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { socket } from '../lib/socket';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Activity, Globe,
  Shield, Zap, RefreshCw, AlertTriangle, BarChart3, Settings, ExternalLink, Mail, Github,
  History, Hash, Timer, ShieldCheck, Play, Pause, MessageSquare, Video, Lock, Wifi, AlertCircle, Calendar, Plus, Trash2
} from 'lucide-react';
import { format, subDays, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useTranslation } from '../lib/i18n';

export default function MonitorDetail({ user, workspace }: any) {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uptimeStats, setUptimeStats] = useState<any[]>([]);
  const [availabilityHistory, setAvailabilityHistory] = useState<any[]>([]);
  const [maintenanceWindows, setMaintenanceWindows] = useState<any[]>([]);
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);
  const [newMaintenance, setNewMaintenance] = useState({ startTime: '', endTime: '' });
  const [activeTab, setActiveTab] = useState<'overview' | 'incidents' | 'settings' | 'maintenance'>('overview');
  const [settings, setSettings] = useState({
    name: '',
    url: '',
    method: 'GET',
    interval: 5,
    alertThreshold: 2,
    alertEmail: '',
    slackWebhook: '',
    telegramChatId: '',
    zoomWebhook: '',
    discordWebhook: '',
    teamsWebhook: '',
    genericWebhook: ''
  });

  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (monitor && monitor.currentStatus) {
      if (prevStatusRef.current) {
        if (prevStatusRef.current === 'down' && monitor.currentStatus === 'up') {
          // Recovered
          toast.success(`${monitor.name} ${t('monitor.status_up')}`, {
            description: t('alerts.systems_recovered'),
            duration: 5000,
          });
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`${t('alerts.systems_recovered')}: ${monitor.name}`, {
              body: `${monitor.name} ${t('monitor.status_up')}.`,
              icon: '/favicon.ico'
            });
          }
        } else if (prevStatusRef.current === 'up' && monitor.currentStatus === 'down') {
          // Went down
          toast.error(`${monitor.name} ${t('monitor.status_down')}`, {
            description: t('alerts.service_down'),
            duration: 5000,
          });
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`${t('alerts.service_down')}: ${monitor.name}`, {
              body: `${monitor.name} ${t('monitor.status_down')}.`,
              icon: '/favicon.ico'
            });
          }
        }
      }
      prevStatusRef.current = monitor.currentStatus;
    }
  }, [monitor?.currentStatus, monitor?.name]);

  useEffect(() => {
    if (monitor) {
      setSettings({
        name: monitor.name || '',
        url: monitor.url || '',
        method: monitor.method || 'GET',
        interval: monitor.interval || 5,
        alertThreshold: monitor.alertThreshold || 2,
        responseTimeThreshold: monitor.responseTimeThreshold || null,
        notifyOnDegraded: monitor.notifyOnDegraded || false,
        alertEmail: monitor.alertEmail || '',
        slackWebhook: monitor.slackWebhook || '',
        telegramChatId: monitor.telegramChatId || '',
        zoomWebhook: monitor.zoomWebhook || '',
        discordWebhook: monitor.discordWebhook || '',
        teamsWebhook: monitor.teamsWebhook || '',
        genericWebhook: monitor.genericWebhook || ''
      });
    }
  }, [monitor]);

  useEffect(() => {
    if (!id) return;

    const fetchMonitor = async () => {
      try {
        const res = await api.get(`/monitors/${id}`);
        setMonitor(res.data);
      } catch (err) {
        console.error('Error fetching monitor:', err);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    const fetchLogs = async () => {
      try {
        const res = await api.get(`/monitors/${id}/logs`);
        const logData = res.data.map((log: any) => ({
          ...log,
          time: format(new Date(log.timestamp), 'HH:mm:ss'),
          timestamp: new Date(log.timestamp)
        })).reverse();
        setLogs(logData);
      } catch (err) {
        console.error('Error fetching logs:', err);
      }
    };

    const fetchStats = async () => {
      try {
        const cacheKey = `stats_${id}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 1000 * 60 * 60) {
            setUptimeStats(data);
            return;
          }
        }

        const res = await api.get(`/monitors/${id}/stats`);
        setUptimeStats(res.data);
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: res.data, timestamp: Date.now() }));
      } catch (err) {
        console.error('Error fetching stats:', err);
      }
    };

    const fetchHistory = async () => {
      try {
        const cacheKey = `availability_history_${id}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 1000 * 60 * 60) {
            const parsedData = data.map((d: any) => ({ ...d, date: new Date(d.date) }));
            setAvailabilityHistory(parsedData);
            return;
          }
        }

        const res = await api.get(`/monitors/${id}/history`);
        const historyData = res.data.map((d: any) => ({
          ...d,
          date: new Date(d.date)
        }));
        setAvailabilityHistory(historyData);
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: historyData, timestamp: Date.now() }));
      } catch (err) {
        console.error('Error fetching history:', err);
      }
    };

    const fetchMaintenanceWindows = async () => {
      try {
        const res = await api.get(`/maintenance-windows?monitorId=${id}`);
        setMaintenanceWindows(res.data);
      } catch (err) {
        console.error('Error fetching maintenance windows:', err);
      }
    };

    fetchMonitor();
    fetchLogs();
    fetchStats();
    fetchHistory();
    fetchMaintenanceWindows();

    const handleMonitorUpdated = (updatedMonitor: any) => {
      if (updatedMonitor.id === id) {
        setMonitor(updatedMonitor);
      }
    };

    const handlePingLog = (log: any) => {
      if (log.monitorId === id) {
        const newLog = {
          ...log,
          time: format(new Date(log.timestamp), 'HH:mm:ss'),
          timestamp: new Date(log.timestamp)
        };
        setLogs(prev => {
          const newLogs = [...prev, newLog];
          if (newLogs.length > 50) return newLogs.slice(newLogs.length - 50);
          return newLogs;
        });
      }
    };

    socket.on('monitor-updated', handleMonitorUpdated);
    socket.on('ping-log', handlePingLog);

    return () => {
      socket.off('monitor-updated', handleMonitorUpdated);
      socket.off('ping-log', handlePingLog);
    };
  }, [id, navigate]);

  const uptimePercentage = logs.length > 0
    ? ((logs.filter(l => l.status === 1 || l.status === 2).length / logs.length) * 100).toFixed(2)
    : '100.00';

  const avgResponseTime = logs.length > 0
    ? Math.round(logs.reduce((acc, curr) => acc + curr.responseTime, 0) / logs.length)
    : 0;

  const minResponseTime = logs.length > 0 ? Math.min(...logs.map(l => l.responseTime)) : 0;
  const maxResponseTime = logs.length > 0 ? Math.max(...logs.map(l => l.responseTime)) : 0;

  const percentiles = React.useMemo(() => {
    if (logs.length === 0) return { p50: 0, p95: 0, p99: 0 };
    const sorted = [...logs].map(l => l.responseTime).sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const idx = Math.floor((p / 100) * sorted.length);
      return sorted[Math.min(idx, sorted.length - 1)];
    };
    return {
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99)
    };
  }, [logs]);

  const statusCodeStats = React.useMemo(() => {
    const counts: Record<number, number> = {};
    logs.forEach(log => {
      const code = log.statusCode || 0;
      counts[code] = (counts[code] || 0) + 1;
    });
    return Object.entries(counts).map(([code, count]) => ({
      name: code === '0' ? 'Error' : `HTTP ${code}`,
      code: parseInt(code),
      value: count,
      fill: code.startsWith('2') ? '#10b981' : code.startsWith('3') ? '#3b82f6' : '#ef4444'
    })).sort((a, b) => b.value - a.value);
  }, [logs]);

  const incidents = React.useMemo(() => {
    const results: any[] = [];
    let lastDownTime: Date | null = null;
    let lastDownError: string | null = null;

    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1];
      const curr = logs[i];
      if (prev.status === 1 && curr.status === 0) {
        lastDownTime = curr.timestamp;
        lastDownError = curr.errorMessage || null;
        results.push({
          type: 'DOWN',
          timestamp: lastDownTime,
          statusCode: curr.statusCode,
          errorMessage: lastDownError
        });
      } else if (prev.status === 0 && curr.status === 1) {
        const upTime = curr.timestamp;
        let duration = null;
        if (lastDownTime && upTime) {
          const diff = upTime.getTime() - lastDownTime.getTime();
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        }
        results.push({
          type: 'UP',
          timestamp: upTime,
          statusCode: curr.statusCode,
          duration,
          errorMessage: curr.errorMessage || null
        });
        lastDownTime = null;
        lastDownError = null;
      }
    }
    return results.reverse();
  }, [logs]);

  const responseTimeDistribution = React.useMemo(() => {
    if (logs.length === 0) return [];
    const times = logs.map(l => l.responseTime);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const bucketSize = Math.max(1, Math.ceil((max - min) / 10));
    const buckets: Record<number, number> = {};

    for (let i = 0; i < 10; i++) {
      buckets[min + (i * bucketSize)] = 0;
    }

    times.forEach(t => {
      const bucketIndex = Math.min(9, Math.floor((t - min) / bucketSize));
      const bucketKey = min + (bucketIndex * bucketSize);
      buckets[bucketKey] = (buckets[bucketKey] || 0) + 1;
    });

    return Object.entries(buckets).map(([range, count]) => ({
      range: `${range}ms`,
      count
    }));
  }, [logs]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await api.put(`/monitors/${id}`, settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const handleAddMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      const res = await api.post('/maintenance-windows', {
        monitorId: id,
        startTime: new Date(newMaintenance.startTime).toISOString(),
        endTime: new Date(newMaintenance.endTime).toISOString()
      });
      setMaintenanceWindows([...maintenanceWindows, res.data]);
      setShowAddMaintenance(false);
      toast.success('Maintenance window added');
    } catch (err) {
      toast.error('Failed to add maintenance window');
    }
  };

  const deleteMaintenanceWindow = async (windowId: string) => {
    try {
      await api.delete(`/maintenance-windows/${windowId}`);
      setMaintenanceWindows(maintenanceWindows.filter(w => w.id !== windowId));
      toast.success('Maintenance window deleted');
    } catch (err) {
      toast.error('Failed to delete maintenance window');
    }
  };

  const toggleStatus = async () => {
    if (!id || !monitor) return;
    const newStatus = monitor.status === 'paused' ? 'up' : 'paused';
    try {
      await api.put(`/monitors/${id}`, { status: newStatus });
      toast.success(`Monitor ${newStatus === 'paused' ? 'paused' : 'resumed'}`, {
        description: `${monitor.name} is now ${newStatus === 'paused' ? 'paused' : 'active'}.`
      });
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Failed to update monitor status');
    }
  };

  if (loading || !monitor) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Header Section */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 pt-8 pb-12">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8"
          >
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              {t('monitor.back')}
            </Link>
          </motion.div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-3 h-3 rounded-full animate-pulse ${monitor.status === 'paused' ? 'bg-zinc-500' :
                    monitor.currentStatus === 'up' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                <h1 className="text-4xl lg:text-5xl font-black font-display tracking-tight text-white">{monitor.name}</h1>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${monitor.status === 'paused' ? 'bg-zinc-800 text-zinc-400' :
                    monitor.currentStatus === 'up' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                      monitor.currentStatus === 'degraded' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                  {monitor.status === 'paused' ? t('dashboard.paused') : monitor.currentStatus === 'up' ? t('dashboard.operational') : monitor.currentStatus === 'degraded' ? t('dashboard.degraded') : t('dashboard.down')}
                </div>
                <button
                  onClick={toggleStatus}
                  className={`ml-2 p-2 rounded-xl transition-colors ${monitor.status === 'paused'
                      ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                      : 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-100'
                    }`}
                  title={monitor.status === 'paused' ? t('dashboard.resume') : t('dashboard.pause')}
                >
                  {monitor.status === 'paused' ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
                </button>
              </div>
              <div className="flex flex-wrap gap-6 text-sm font-medium text-zinc-500">
                <a href={monitor.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Globe className="w-4 h-4" />
                  {monitor.url}
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {t('dashboard.interval')}: {monitor.interval}s
                </div>
                {monitor.monitorType === 'HTTP' && (
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {monitor.method} {t('dashboard.method')}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  {t('dashboard.last_check')} {monitor.lastChecked ? formatDistanceToNow(new Date(monitor.lastChecked), { addSuffix: true }) : t('common.never')}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-4"
            >
              <div className="glass px-6 py-4 rounded-3xl border border-white/5 min-w-[140px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/5 blur-2xl -z-10 group-hover:bg-green-500/10 transition-colors" />
                <div className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-1">{t('monitor.uptime')} (24h)</div>
                <div className="text-2xl font-black text-green-500">{uptimePercentage}%</div>
              </div>
              <div className="glass px-6 py-4 rounded-3xl border border-white/5 min-w-[140px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/5 blur-2xl -z-10 group-hover:bg-orange-500/10 transition-colors" />
                <div className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-1">{t('monitor.avg_response')}</div>
                <div className="text-2xl font-black text-orange-500">{avgResponseTime}<span className="text-xs ml-1 font-bold">ms</span></div>
              </div>
              <div className="glass px-6 py-4 rounded-3xl border border-white/5 min-w-[140px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 blur-2xl -z-10 group-hover:bg-blue-500/10 transition-colors" />
                <div className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-1">{t('monitor.min_response')}</div>
                <div className="text-2xl font-black text-blue-500">{minResponseTime}<span className="text-xs ml-1 font-bold">ms</span></div>
              </div>
              <div className="glass px-6 py-4 rounded-3xl border border-white/5 min-w-[140px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 blur-2xl -z-10 group-hover:bg-purple-500/10 transition-colors" />
                <div className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-1">{t('monitor.max_response')}</div>
                <div className="text-2xl font-black text-purple-500">{maxResponseTime}<span className="text-xs ml-1 font-bold">ms</span></div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 -mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Tab Switcher */}
            <div className="flex items-center gap-2 p-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl w-fit">
              {[
                { id: 'overview', label: t('monitor.overview'), icon: Activity },
                { id: 'incidents', label: t('monitor.incidents'), icon: History },
                { id: 'maintenance', label: t('monitor.maintenance'), icon: Calendar },
                { id: 'settings', label: t('monitor.settings_tab'), icon: Settings }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                      ? 'bg-white text-zinc-950 shadow-lg shadow-white/5'
                      : 'text-zinc-500 hover:text-white'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  {/* 30-Day Availability History */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="glass border border-white/5 p-8 rounded-[2.5rem] card-gradient"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                          <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        </div>
                        <h3 className="font-black text-white uppercase tracking-widest text-sm">{t('monitor.availability')}</h3>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                        {availabilityHistory.length > 0 ? `${Math.round(availabilityHistory.reduce((acc, curr) => acc + (curr.uptime > -1 ? curr.uptime : 100), 0) / availabilityHistory.length)}% ${t('monitor.avg')}` : t('monitor.calculating')}
                      </div>
                    </div>

                    <div className="flex items-end gap-1 h-12 w-full">
                      {availabilityHistory.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600 italic">
                          {t('common.loading')}
                        </div>
                      ) : (
                        availabilityHistory.map((day, i) => {
                          let colorClass = 'bg-zinc-800'; // No data
                          if (day.uptime === 100) colorClass = 'bg-emerald-500';
                          else if (day.uptime >= 95) colorClass = 'bg-yellow-500';
                          else if (day.uptime >= 0) colorClass = 'bg-red-500';

                          return (
                            <div
                              key={i}
                              className={`flex-1 rounded-sm relative group cursor-pointer transition-all hover:opacity-80 ${colorClass}`}
                              style={{ height: day.uptime === -1 ? '20%' : '100%' }}
                            >
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-zinc-900 border border-zinc-800 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                                <div className="font-bold mb-1">{format(day.date, 'MMM d, yyyy')}</div>
                                <div className="text-zinc-400">
                                  {day.uptime === -1 ? t('dashboard.no_data') : t('monitor.uptime_desc').replace('{uptime}', day.uptime.toFixed(2))}
                                </div>
                                {day.down > 0 && (
                                  <div className="text-red-400 mt-1">
                                    {t('monitor.failed_checks').replace('{count}', day.down.toString())}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="flex justify-between mt-3 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                      <span>{t('monitor.30_days_ago')}</span>
                      <span>{t('monitor.today')}</span>
                    </div>
                  </motion.div>

                  {/* Response Time Chart */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass border border-white/5 p-8 rounded-[2.5rem] card-gradient"
                  >
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-xl">
                          <Activity className="w-5 h-5 text-orange-500" />
                        </div>
                        <h3 className="font-black text-white uppercase tracking-widest text-sm">{t('monitor.response_time')} (ms)</h3>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{t('monitor.latest_checks')}</div>
                    </div>

                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={logs}>
                          <defs>
                            <linearGradient id="colorRes" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                          <XAxis
                            dataKey="time"
                            stroke="#444"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={30}
                            fontFamily="JetBrains Mono"
                          />
                          <YAxis
                            stroke="#444"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            unit="ms"
                            fontFamily="JetBrains Mono"
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#09090b',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '16px',
                              fontSize: '12px',
                              fontFamily: 'JetBrains Mono',
                              boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                            }}
                            itemStyle={{ color: '#f97316' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="responseTime"
                            stroke="#f97316"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorRes)"
                            animationDuration={1500}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>

                  {/* Response Time Distribution */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="glass border border-white/5 p-8 rounded-[2.5rem] card-gradient"
                  >
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-xl">
                          <BarChart3 className="w-5 h-5 text-purple-500" />
                        </div>
                        <h3 className="font-black text-white uppercase tracking-widest text-sm">{t('monitor.latency_distribution')}</h3>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{t('monitor.frequency_by_range')}</div>
                    </div>

                    <div className="h-[150px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={responseTimeDistribution}>
                          <XAxis
                            dataKey="range"
                            stroke="#444"
                            fontSize={8}
                            tickLine={false}
                            axisLine={false}
                            fontFamily="JetBrains Mono"
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#09090b',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '16px',
                              fontSize: '12px',
                              fontFamily: 'JetBrains Mono'
                            }}
                          />
                          <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>

                  {/* Uptime History Chart */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass border border-white/5 p-8 rounded-[2.5rem] card-gradient"
                  >
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-xl">
                          <BarChart3 className="w-5 h-5 text-green-500" />
                        </div>
                        <h3 className="font-black text-white uppercase tracking-widest text-sm">{t('monitor.uptime_chart')}</h3>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{t('monitor.period_comparison')}</div>
                    </div>

                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={uptimeStats} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                          <XAxis
                            dataKey="name"
                            stroke="#444"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            fontFamily="JetBrains Mono"
                          />
                          <YAxis
                            stroke="#444"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            domain={[90, 100]}
                            unit="%"
                            fontFamily="JetBrains Mono"
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#09090b',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '16px',
                              fontSize: '12px',
                              fontFamily: 'JetBrains Mono'
                            }}
                            cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                          />
                          <Bar dataKey="uptime" radius={[8, 8, 0, 0]} barSize={60}>
                            {uptimeStats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.uptime > 99 ? '#22c55e' : entry.uptime > 95 ? '#eab308' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Status Code Distribution */}
                    {monitor.monitorType === 'HTTP' && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="glass border border-white/5 p-8 rounded-[2.5rem] card-gradient"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-xl">
                              <Hash className="w-5 h-5 text-blue-500" />
                            </div>
                            <h3 className="font-black text-white uppercase tracking-widest text-sm">{t('monitor.status_codes')}</h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-8">
                          <div className="w-32 h-32 shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={statusCodeStats}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={35}
                                  outerRadius={50}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {statusCodeStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: '#09090b',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontFamily: 'JetBrains Mono'
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex-1 space-y-3">
                            {statusCodeStats.map((stat, i) => (
                              <div key={stat.code} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.fill }} />
                                  <span className="text-[10px] font-mono font-bold text-zinc-300">{stat.name}</span>
                                </div>
                                <span className="text-[10px] font-mono text-zinc-500">{stat.value} ({((stat.value / logs.length) * 100).toFixed(0)}%)</span>
                              </div>
                            ))}
                            {statusCodeStats.length === 0 && (
                              <div className="text-center py-10 text-zinc-600 text-xs italic">{t('monitor.no_data_available')}</div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Incident Timeline */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="glass border border-white/5 p-8 rounded-[2.5rem] card-gradient"
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-red-500/10 rounded-xl">
                          <History className="w-5 h-5 text-red-500" />
                        </div>
                        <h3 className="font-black text-white uppercase tracking-widest text-sm">{t('monitor.recent_incidents')}</h3>
                      </div>
                      <div className="space-y-6 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {incidents.map((incident, i) => (
                          <div key={i} className="flex gap-4 relative group">
                            {i !== incidents.length - 1 && (
                              <div className={`absolute left-[11px] top-6 bottom-[-24px] w-[2px] ${incident.type === 'UP' ? 'bg-red-500/30' : 'bg-emerald-500/30'
                                }`} />
                            )}
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${incident.type === 'DOWN' ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                              }`}>
                              {incident.type === 'DOWN' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            </div>
                            <div className={`flex-1 p-3 rounded-xl border ${incident.type === 'DOWN' ? 'bg-red-500/5 border-red-500/10' : 'bg-emerald-500/5 border-emerald-500/10'
                              }`}>
                              <div className={`text-xs font-bold mb-0.5 ${incident.type === 'DOWN' ? 'text-red-400' : 'text-emerald-400'}`}>
                                {t('dashboard.title')} {incident.type === 'DOWN' ? t('monitor.went_down') : t('monitor.recovered')}
                                {incident.duration && (
                                  <span className="ml-2 opacity-70 font-normal">
                                    ({t('monitor.down_for').replace('{duration}', incident.duration)})
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-500 mb-1">
                                {format(incident.timestamp, 'MMM d, HH:mm:ss')} • HTTP {incident.statusCode || 'ERR'}
                              </div>
                              {incident.errorMessage && (
                                <div className="text-[9px] font-mono text-red-400 bg-red-400/10 px-2 py-1 rounded border border-red-400/20 max-w-xs truncate mt-2">
                                  {incident.errorMessage}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {incidents.length === 0 && (
                          <div className="text-center py-10 text-zinc-600 text-xs italic">{t('monitor.no_incidents_detected')}</div>
                        )}
                      </div>
                    </motion.div>
                  </div>

                  {/* Recent Events List */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="glass border border-white/5 rounded-[2.5rem] overflow-hidden card-gradient"
                  >
                    <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
                      <h3 className="font-black text-white uppercase tracking-widest text-sm">{t('monitor.recent_events')}</h3>
                      <div className="px-3 py-1 bg-zinc-800 rounded-full text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        {t('monitor.live_feed')}
                      </div>
                    </div>
                    <div className="divide-y divide-white/5">
                      {logs.slice().reverse().slice(0, 15).map((log, idx) => (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + (idx * 0.05) }}
                          key={log.id}
                          className="px-8 py-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors group"
                        >
                          <div className="flex items-center gap-6">
                            <div className={`p-2 rounded-xl ${log.status === 1 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                              {log.status === 1 ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm mb-1">
                                {log.status === 1 ? 'Service is Operational' : 'Service Outage Detected'}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                                HTTP {log.statusCode || 'ERROR'} • {log.responseTime}ms • {log.method || 'GET'}
                              </div>
                            </div>
                          </div>
                          <div className="text-zinc-500 text-[10px] font-black uppercase tracking-widest group-hover:text-zinc-300 transition-colors">
                            {log.timestamp ? format(log.timestamp, 'MMM d, HH:mm:ss') : 'Pending'}
                          </div>
                        </motion.div>
                      ))}
                      {logs.length === 0 && (
                        <div className="p-20 text-center">
                          <RefreshCw className="w-10 h-10 text-zinc-800 mx-auto mb-4 animate-spin" />
                          <p className="text-zinc-500 font-medium italic">Waiting for initial logs...</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {activeTab === 'incidents' && (
                <motion.div
                  key="incidents"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  {/* Full Incident History */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass border border-white/5 p-8 rounded-[2.5rem] card-gradient"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-2 bg-red-500/10 rounded-xl">
                        <History className="w-5 h-5 text-red-500" />
                      </div>
                      <h3 className="font-black text-white uppercase tracking-widest text-sm">{t('monitor.full_incident_history')}</h3>
                    </div>
                    <div className="space-y-4">
                      {incidents.map((incident, i) => (
                        <div key={i} className={`flex items-center justify-between p-6 border-l-4 rounded-r-2xl rounded-l-sm transition-colors ${incident.type === 'DOWN' ? 'border-l-red-500 border-y border-r border-y-red-500/10 border-r-red-500/10 bg-red-500/[0.02] hover:bg-red-500/[0.04]' : 'border-l-emerald-500 border-y border-r border-y-emerald-500/10 border-r-emerald-500/10 bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04]'
                          }`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${incident.type === 'DOWN' ? 'bg-red-500/20 text-red-500 shadow-red-500/10' : 'bg-emerald-500/20 text-emerald-500 shadow-emerald-500/10'
                              }`}>
                              {incident.type === 'DOWN' ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                            </div>
                            <div>
                              <div className={`font-bold text-lg ${incident.type === 'DOWN' ? 'text-red-400' : 'text-emerald-400'}`}>
                                {incident.type === 'DOWN' ? 'Service Outage' : 'System Recovery'}
                                {incident.duration && (
                                  <span className="ml-3 opacity-70 font-normal text-sm">
                                    (Downtime: {incident.duration})
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-mono text-zinc-400 mb-2 mt-1">
                                {format(incident.timestamp, 'MMMM d, yyyy • HH:mm:ss')}
                              </div>
                              {incident.errorMessage && (
                                <div className="text-xs font-mono text-red-400 bg-red-400/10 px-3 py-2 rounded-lg border border-red-400/20 inline-block mt-1">
                                  Error: {incident.errorMessage}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">Status</div>
                            <div className={`text-xs font-mono font-bold px-3 py-1.5 rounded-md inline-block ${incident.type === 'DOWN' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                              HTTP {incident.statusCode || 'ERR'}
                            </div>
                          </div>
                        </div>
                      ))}
                      {incidents.length === 0 && (
                        <div className="py-20 text-center text-zinc-600 italic">{t('monitor.no_incidents_recorded')}</div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {activeTab === 'maintenance' && (
                <motion.div
                  key="maintenance"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <motion.div
                    className="glass border border-white/5 p-8 rounded-[2.5rem] card-gradient"
                  >
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                          <Calendar className="w-5 h-5 text-blue-500" />
                        </div>
                        <h3 className="font-black text-white uppercase tracking-widest text-sm">{t('monitor.maintenance_windows')}</h3>
                      </div>
                      <button
                        onClick={() => setShowAddMaintenance(true)}
                        className="bg-white text-zinc-950 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {t('monitor.add_window')}
                      </button>
                    </div>

                    {showAddMaintenance && (
                      <form onSubmit={handleAddMaintenance} className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 mb-8 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{t('monitor.start_time')}</label>
                            <input 
                              type="datetime-local" 
                              required
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                              value={newMaintenance.startTime}
                              onChange={e => setNewMaintenance({...newMaintenance, startTime: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">{t('monitor.end_time')}</label>
                            <input 
                              type="datetime-local" 
                              required
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                              value={newMaintenance.endTime}
                              onChange={e => setNewMaintenance({...newMaintenance, endTime: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="flex gap-3 justify-end pt-2">
                          <button 
                            type="button"
                            onClick={() => setShowAddMaintenance(false)}
                            className="px-6 py-3 rounded-xl font-bold border border-zinc-800 hover:bg-zinc-800 transition-colors text-xs"
                          >
                            {t('common.cancel')}
                          </button>
                          <button 
                            type="submit"
                            className="bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all text-xs"
                          >
                            {t('monitor.save_window')}
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="space-y-3">
                      {maintenanceWindows.map((win) => {
                        const isUpcoming = new Date(win.startTime) > new Date();
                        const isActive = new Date(win.startTime) <= new Date() && new Date(win.endTime) >= new Date();
                        const isPast = new Date(win.endTime) < new Date();

                        return (
                          <div key={win.id} className="flex items-center justify-between p-5 bg-zinc-900/30 border border-white/5 rounded-2xl hover:bg-zinc-900/50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-blue-500 animate-pulse' : isUpcoming ? 'bg-amber-500' : 'bg-zinc-600'}`} />
                              <div>
                                <div className="text-sm font-bold text-white mb-1">
                                  {format(new Date(win.startTime), 'MMM d, HH:mm')} — {format(new Date(win.endTime), 'MMM d, HH:mm')}
                                </div>
                                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                  {isActive ? t('monitor.active_suppressed') : isUpcoming ? t('monitor.upcoming') : t('monitor.past')}
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={() => deleteMaintenanceWindow(win.id)}
                              className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                      {maintenanceWindows.length === 0 && (
                        <div className="py-12 text-center text-zinc-500 italic text-sm">
                          {t('monitor.no_maintenance')}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass border border-white/5 p-10 rounded-[2.5rem] card-gradient relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] -z-10" />

                    <div className="flex items-center justify-between mb-10">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-500/10 rounded-2xl">
                          <Settings className="w-8 h-8 text-orange-500" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-white font-display tracking-tight">{t('monitor.settings_title')}</h3>
                          <p className="text-sm text-zinc-500 font-medium">Update your service tracking parameters and alert rules.</p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleSaveSettings} className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('monitor.name')}</label>
                          <input
                            type="text"
                            required
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold"
                            value={settings.name}
                            onChange={e => setSettings({ ...settings, name: e.target.value })}
                          />
                        </div>

                        <div className="space-y-4">
                          <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Target URL</label>
                          <div className="relative">
                            <Globe className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                            <input
                              type="url"
                              required
                              placeholder="https://example.com"
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold"
                              value={settings.url}
                              onChange={e => setSettings({ ...settings, url: e.target.value })}
                            />
                          </div>
                        </div>

                        {monitor.monitorType === 'HTTP' && (
                          <div className="space-y-4">
                            <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">HTTP Method</label>
                            <select
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold appearance-none"
                              value={settings.method}
                              onChange={e => setSettings({ ...settings, method: e.target.value })}
                            >
                              <option value="GET">GET</option>
                              <option value="POST">POST</option>
                              <option value="PUT">PUT</option>
                              <option value="DELETE">DELETE</option>
                              <option value="HEAD">HEAD</option>
                            </select>
                          </div>
                        )}

                        <div className="space-y-4">
                          <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Check Interval (min)</label>
                          <div className="relative">
                            <Clock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                            <input
                              type="number"
                              min="1"
                              max="60"
                              required
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold"
                              value={settings.interval}
                              onChange={e => setSettings({ ...settings, interval: parseInt(e.target.value) })}
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('monitor.alert_threshold')}</label>
                          <div className="flex items-center gap-4">
                            <input
                              type="number"
                              min="1"
                              max="10"
                              required
                              className="w-24 bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-lg font-black text-center"
                              value={settings.alertThreshold}
                              onChange={e => setSettings({ ...settings, alertThreshold: parseInt(e.target.value) })}
                            />
                            <span className="text-xs text-zinc-500 font-bold leading-tight">Consecutive failures before<br />triggering an alert notification</span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Response Time Threshold (ms)</label>
                          <div className="flex items-center gap-4">
                            <input
                              type="number"
                              min="0"
                              step="50"
                              placeholder="e.g. 5000"
                              className="w-32 bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-lg font-black text-center"
                              value={settings.responseTimeThreshold || ''}
                              onChange={e => setSettings({ ...settings, responseTimeThreshold: e.target.value ? parseInt(e.target.value) : null })}
                            />
                            <span className="text-xs text-zinc-500 font-bold leading-tight">Maximum allowed response time<br />before triggering an alert</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
                          <div>
                            <p className="text-sm font-bold text-white">Alert on Performance Degradation</p>
                            <p className="text-xs text-zinc-500 font-medium mt-1">Send notifications when response time exceeds the threshold above. If disabled, the UI will still show the degraded state but no alerts will be dispatched.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSettings({ ...settings, notifyOnDegraded: !settings.notifyOnDegraded })}
                            className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.notifyOnDegraded ? 'bg-amber-500' : 'bg-zinc-700'}`}
                          >
                            <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.notifyOnDegraded ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        <div className="space-y-4">
                          <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('monitor.email_notification')}</label>
                          <div className="relative">
                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                            <input
                              type="email"
                              placeholder="alerts@example.com"
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                              value={settings.alertEmail}
                              onChange={e => setSettings({ ...settings, alertEmail: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Slack Webhook URL</label>
                        <div className="relative">
                          <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                          <input
                            type="url"
                            placeholder="https://hooks.slack.com/services/..."
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                            value={settings.slackWebhook}
                            onChange={e => setSettings({ ...settings, slackWebhook: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Telegram Chat ID</label>
                        <div className="relative">
                          <MessageSquare className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                          <input
                            type="text"
                            placeholder="-100123456789"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                            value={settings.telegramChatId}
                            onChange={e => setSettings({ ...settings, telegramChatId: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Zoom Webhook URL</label>
                        <div className="relative">
                          <Video className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                          <input
                            type="url"
                            placeholder="https://zoom.us/..."
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                            value={settings.zoomWebhook}
                            onChange={e => setSettings({ ...settings, zoomWebhook: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('monitor.discord_webhook')}</label>
                        <div className="relative">
                          <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                          <input
                            type="url"
                            placeholder="https://discord.com/api/webhooks/..."
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-[#5865F2]/60 transition-colors text-sm"
                            value={settings.discordWebhook}
                            onChange={e => setSettings({ ...settings, discordWebhook: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('monitor.teams_webhook')}</label>
                        <div className="relative">
                          <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                          <input
                            type="url"
                            placeholder="https://outlook.office.com/webhook/..."
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-[#6264a7]/60 transition-colors text-sm"
                            value={settings.teamsWebhook}
                            onChange={e => setSettings({ ...settings, teamsWebhook: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('monitor.generic_webhook')}</label>
                        <div className="relative">
                          <Wifi className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                          <input
                            type="url"
                            placeholder="https://your-service.com/webhook"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                            value={settings.genericWebhook}
                            onChange={e => setSettings({ ...settings, genericWebhook: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-6">
                        <button
                          type="submit"
                          className="bg-white text-zinc-950 px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/5 flex items-center gap-3"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          Save Configuration
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* SSL Certificate Card */}
            {monitor.monitorType === 'HTTP' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="glass border border-white/5 p-6 rounded-[2.5rem] card-gradient"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className={`p-2 rounded-xl ${
                    !monitor?.sslValid && monitor?.sslLastChecked ? 'bg-red-500/10' :
                    monitor?.sslDaysLeft !== null && monitor?.sslDaysLeft <= 7 ? 'bg-red-500/10' :
                    monitor?.sslDaysLeft !== null && monitor?.sslDaysLeft <= 30 ? 'bg-amber-500/10' :
                    'bg-emerald-500/10'
                  }`}>
                    <Lock className={`w-4 h-4 ${
                      !monitor?.sslValid && monitor?.sslLastChecked ? 'text-red-500' :
                      monitor?.sslDaysLeft !== null && monitor?.sslDaysLeft <= 7 ? 'text-red-500' :
                      monitor?.sslDaysLeft !== null && monitor?.sslDaysLeft <= 30 ? 'text-amber-500' :
                      'text-emerald-500'
                    }`} />
                  </div>
                  <h3 className="font-black text-white uppercase tracking-widest text-xs">{t('monitor.ssl_title')}</h3>
                  {monitor?.sslLastChecked && (
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      monitor.sslDaysLeft !== null && monitor.sslDaysLeft <= 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      !monitor.sslValid ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      monitor.sslDaysLeft <= 7 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      monitor.sslDaysLeft <= 30 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {monitor.sslDaysLeft !== null && monitor.sslDaysLeft <= 0 ? t('monitor.ssl_expired') : monitor.sslValid ? t('monitor.ssl_valid') : t('monitor.ssl_invalid')}
                    </span>
                  )}
                </div>

                {!monitor?.sslLastChecked ? (
                  <p className="text-xs text-zinc-500 italic">{monitor?.url?.startsWith('https') ? t('monitor.ssl_checking') : t('monitor.ssl_not_https')}</p>
                ) : (
                  <div className="space-y-3">
                    {monitor.sslDaysLeft !== null && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t('monitor.ssl_days_left').replace('{days}', '')}</span>
                        <span className={`text-sm font-black ${
                          monitor.sslDaysLeft <= 7 ? 'text-red-400' :
                          monitor.sslDaysLeft <= 30 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>{monitor.sslDaysLeft}d</span>
                      </div>
                    )}
                    {monitor.sslExpiry && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t('monitor.ssl_expiry')}</span>
                        <span className="text-[11px] font-mono text-zinc-300">{format(new Date(monitor.sslExpiry), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                    {monitor.sslIssuer && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t('monitor.ssl_issuer')}</span>
                        <span className="text-[11px] font-mono text-zinc-300 truncate max-w-[120px]">{monitor.sslIssuer}</span>
                      </div>
                    )}
                    {monitor.sslSubject && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t('monitor.ssl_subject')}</span>
                        <span className="text-[11px] font-mono text-zinc-300 truncate max-w-[120px]">{monitor.sslSubject}</span>
                      </div>
                    )}
                    {monitor.sslDaysLeft !== null && (
                      <div className="mt-3">
                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (monitor.sslDaysLeft / 365) * 100)}%` }}
                            transition={{ duration: 1.2, ease: 'easeOut' }}
                            className={`h-full rounded-full ${
                              monitor.sslDaysLeft <= 7 ? 'bg-red-500' :
                              monitor.sslDaysLeft <= 30 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                        </div>
                        <p className={`text-[10px] mt-2 font-bold ${
                          monitor.sslDaysLeft <= 7 ? 'text-red-400' :
                          monitor.sslDaysLeft <= 30 ? 'text-amber-400' : 'text-zinc-500'
                        }`}>
                          {monitor.sslDaysLeft <= 0 ? t('monitor.ssl_expired') :
                           monitor.sslDaysLeft <= 7 ? t('monitor.ssl_critical') :
                           monitor.sslDaysLeft <= 30 ? t('monitor.ssl_warning') :
                           t('monitor.ssl_healthy')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* DNS Card */}
            {(monitor?.dnsResolvedIp || monitor?.dnsResolutionTime) && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 }}
                className="glass border border-white/5 p-6 rounded-[2.5rem] card-gradient"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-blue-500/10 rounded-xl">
                    <Globe className="w-4 h-4 text-blue-400" />
                  </div>
                  <h3 className="font-black text-white uppercase tracking-widest text-xs">{t('monitor.dns_title')}</h3>
                </div>
                <div className="space-y-3">
                  {monitor.dnsResolvedIp && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t('monitor.dns_resolved_ip')}</span>
                      <span className="text-[11px] font-mono text-zinc-300">{monitor.dnsResolvedIp}</span>
                    </div>
                  )}
                  {monitor.dnsResolutionTime !== null && monitor.dnsResolutionTime !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t('monitor.dns_resolution_time')}</span>
                      <span className="text-[11px] font-mono text-zinc-300">{monitor.dnsResolutionTime}ms</span>
                    </div>
                  )}
                  {monitor.dnsLastChanged && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t('monitor.dns_last_changed')}</span>
                      <span className="text-[11px] font-mono text-amber-400">{formatDistanceToNow(new Date(monitor.dnsLastChanged), { addSuffix: true })}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* SLA Compliance Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="glass border border-white/5 p-8 rounded-[2.5rem] card-gradient"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-white uppercase tracking-widest text-xs flex items-center gap-3">
                  <div className="p-1.5 bg-zinc-800 rounded-lg">
                    <ShieldCheck className="w-4 h-4 text-zinc-400" />
                  </div>
                  {t('monitor.sla_compliance')}
                </h3>
                <div className="px-2 py-0.5 bg-zinc-800 rounded-full text-[8px] font-black text-zinc-500 uppercase tracking-widest">{t('monitor.sla_target')}: 99.9%</div>
              </div>
              <div className="space-y-6">
                {uptimeStats.filter(s => ['30d', '90d', '365d'].includes(s.name)).map((stat) => (
                  <div key={stat.name}>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                      <span>{stat.name === '30d' ? t('monitor.monthly') : stat.name === '90d' ? t('monitor.quarterly') : t('monitor.yearly')}</span>
                      <span className={stat.uptime >= 99.9 ? 'text-emerald-500' : 'text-orange-500'}>{stat.uptime}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stat.uptime}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className={`h-full ${stat.uptime >= 99.9 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                      />
                    </div>
                  </div>
                ))}
                {uptimeStats.length === 0 && (
                  <div className="text-center py-4 text-zinc-600 text-xs italic">{t('monitor.calculating_sla')}</div>
                )}
              </div>
            </motion.div>

            {/* Latency Percentiles */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
              className="glass border border-white/5 p-8 rounded-[2.5rem] card-gradient"
            >
              <h3 className="font-black text-white uppercase tracking-widest text-xs mb-6 flex items-center gap-3">
                <div className="p-1.5 bg-zinc-800 rounded-lg">
                  <Timer className="w-4 h-4 text-zinc-400" />
                </div>
                {t('monitor.latency_percentiles')}
              </h3>
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{t('monitor.p50')}</span>
                  <span className="text-white font-mono text-xs">{percentiles.p50}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{t('monitor.p95')}</span>
                  <span className="text-orange-500 font-mono text-xs font-bold">{percentiles.p95}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{t('monitor.p99')}</span>
                  <span className="text-red-500 font-mono text-xs font-bold">{percentiles.p99}ms</span>
                </div>
              </div>
            </motion.div>

            {/* Monitor Config */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass border border-white/5 p-8 rounded-[2.5rem] card-gradient"
            >
              <h3 className="font-black text-white uppercase tracking-widest text-xs mb-6 flex items-center gap-3">
                <div className="p-1.5 bg-zinc-800 rounded-lg">
                  <Shield className="w-4 h-4 text-zinc-400" />
                </div>
                {t('monitor.settings_title')}
              </h3>
              <div className="space-y-5">
                {monitor.monitorType === 'HTTP' && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{t('monitor.method')}</span>
                    <span className="text-white font-mono text-xs bg-zinc-800 px-2 py-1 rounded-md">{monitor.method}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{t('monitor.interval')}</span>
                  <span className="text-white text-xs font-black">{monitor.interval}s</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{t('monitor.timeout')}</span>
                  <span className="text-white text-xs font-black">10s</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Created</span>
                  <span className="text-white text-xs font-black">
                    {monitor.createdAt ? format(new Date(monitor.createdAt), 'MMM d, yyyy') : 'N/A'}
                  </span>
                </div>
              </div>
            </motion.div>


            {/* Quick Stats */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="glass border border-white/5 p-8 rounded-[2.5rem] card-gradient"
            >
              <h3 className="font-black text-white uppercase tracking-widest text-xs mb-6">{t('monitor.system_health')}</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                    <span>{t('monitor.reliability')}</span>
                    <span className="text-green-500">{uptimePercentage}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${uptimePercentage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-green-500"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                    <span>{t('monitor.performance')}</span>
                    <span className="text-orange-500">{Math.max(0, 100 - (avgResponseTime / 10))}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(0, 100 - (avgResponseTime / 10))}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-orange-500"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
