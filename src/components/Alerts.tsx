import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AlertTriangle, CheckCircle2, XCircle, Clock, ShieldAlert, Activity, Filter, RefreshCw, Hash, ExternalLink } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import api from '../lib/api';
import { socket } from '../lib/socket';
import { useTranslation } from '../lib/i18n';

export default function Alerts({ workspace }: { user: any; workspace: any }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active'>('all');
  const { t } = useTranslation();

  useEffect(() => {
    if (!workspace) return;

    const fetchAlerts = async () => {
      try {
        const res = await api.get(`/alerts?workspaceId=${workspace.id}`);
        setLogs(res.data);
      } catch (err) {
        console.error('Failed to fetch alerts', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();

    const handlePingLog = (log: any) => {
      // Assuming socket doesn't send monitor details, we might just re-fetch, 
      // but for simplicity, wait for periodic refresh or user interaction.
      // Easiest is to add it if we had monitor data, but since we don't naturally,
      // we can just optionally refetch if needed.
    };

    socket.connect();
    socket.on('ping-log', handlePingLog);

    return () => {
      socket.off('ping-log', handlePingLog);
    };
  }, [workspace]);

  // Process raw logs into incidents
  const incidents = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    logs.forEach(log => {
      if (!grouped[log.monitorId]) grouped[log.monitorId] = [];
      grouped[log.monitorId].push(log);
    });

    const results: any[] = [];
    Object.keys(grouped).forEach(monitorId => {
      const monitorLogs = grouped[monitorId].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      let lastDownTime: Date | null = null;
      let lastDownError: string | null = null;

      for (let i = 0; i < monitorLogs.length; i++) {
        const curr = monitorLogs[i];
        const prev = i > 0 ? monitorLogs[i - 1] : null;

        const isIncident = curr.status === 0 || curr.status === 2;
        const wasNormal = !prev || prev.status === 1;
        const isDifferentIncident = prev && (prev.status === 0 || prev.status === 2) && prev.status !== curr.status;

        if (isIncident && (wasNormal || isDifferentIncident)) {
          lastDownTime = new Date(curr.timestamp);
          lastDownError = curr.errorMessage || (curr.status === 0 ? `HTTP ${curr.statusCode}` : `Performance degraded`);
          results.push({
            id: `${curr.id}-${curr.status === 0 ? 'down' : 'degraded'}`,
            monitor: curr.monitor,
            type: curr.status === 0 ? 'DOWN' : 'DEGRADED',
            timestamp: lastDownTime,
            errorMessage: lastDownError,
            statusCode: curr.statusCode,
          });
        } else if (curr.status === 1 && prev && (prev.status === 0 || prev.status === 2)) {
          const upTime = new Date(curr.timestamp);
          let duration = null;
          if (lastDownTime && upTime) {
            const diff = upTime.getTime() - lastDownTime.getTime();
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
          }
          results.push({
            id: `${curr.id}-up`,
            monitor: curr.monitor,
            type: 'UP',
            timestamp: upTime,
            duration,
            statusCode: curr.statusCode
          });
          lastDownTime = null;
        }
      }

      // If still down at the end of the logs
      if (lastDownTime && monitorLogs[monitorLogs.length - 1].status === 0) {
         // It's actively down
         const lastLog = monitorLogs[monitorLogs.length - 1];
         // We already pushed the initial DOWN event above, so we don't push another.
         // We can tag the initial event as 'active' if needed.
         const lastIncident = results.find(r => (r.type === 'DOWN' || r.type === 'DEGRADED') && r.monitor.id === monitorId && r.timestamp === lastDownTime);
         if (lastIncident) {
            lastIncident.isActive = true;
         }
      }
    });

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [logs]);

  const filteredIncidents = filter === 'active' ? incidents.filter(i => i.isActive) : incidents;
  const activeCount = incidents.filter(i => i.isActive).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <Activity className="w-8 h-8 text-orange-500 animate-pulse mb-4" />
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{t('alerts.loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 pt-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-[0.2em] mb-3"
          >
            <Bell className="w-4 h-4" />
            Global Alerts Feed
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl font-bold tracking-tight text-white mb-2 font-display"
          >
            {t('alerts.title')}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-500 text-lg"
          >
            {t('alerts.subtitle').replace('{workspace}', workspace?.name || '')}
          </motion.p>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800"
        >
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
          >
            {t('alerts.all_history')}
          </button>
          <button 
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${filter === 'active' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'text-zinc-500 hover:text-red-500'}`}
          >
            {t('alerts.active_incidents')}
            {activeCount > 0 && <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px]">{activeCount}</span>}
          </button>
        </motion.div>
      </header>

      <div className="space-y-6 relative">
        <div className="absolute left-6 top-4 bottom-4 w-[2px] bg-zinc-900 rounded-full" />
        
        <AnimatePresence mode="popLayout">
          {filteredIncidents.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="pl-16 py-12"
            >
              <div className="glass border border-white/5 rounded-3xl p-10 text-center flex flex-col items-center max-w-lg">
                 <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                   <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                 </div>
                 <h3 className="text-xl font-black text-white mb-2">{t('alerts.all_operational')}</h3>
                 <p className="text-zinc-500 text-sm">{t('alerts.all_operational_desc')}</p>
              </div>
            </motion.div>
          ) : (
            filteredIncidents.map((incident, idx) => (
              <motion.div 
                key={incident.id}
                layout
                initial={{ opacity: 0, x: -20, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="pl-16 relative"
              >
                {/* Timeline Node */}
                <div className={`absolute top-6 left-[18px] w-4 h-4 rounded-full border-4 border-zinc-950 shadow-xl flex items-center justify-center z-10 ${
                  incident.type === 'DOWN' ? 'bg-red-500 shadow-red-500/40' : 
                  incident.type === 'DEGRADED' ? 'bg-amber-500 shadow-amber-500/40' : 
                  'bg-emerald-500 shadow-emerald-500/40'
                }`} />

                <div className={`glass p-6 rounded-3xl border transition-colors group relative overflow-hidden ${
                  incident.type === 'DOWN' 
                    ? incident.isActive 
                      ? 'bg-red-500/[0.03] border-red-500/30 shadow-2xl shadow-red-500/10' 
                      : 'bg-zinc-900/40 border-red-500/10 hover:border-red-500/30' 
                    : incident.type === 'DEGRADED'
                      ? incident.isActive
                        ? 'bg-amber-500/[0.03] border-amber-500/30 shadow-2xl shadow-amber-500/10' 
                        : 'bg-zinc-900/40 border-amber-500/10 hover:border-amber-500/30'
                      : 'bg-zinc-900/40 border-emerald-500/10 hover:border-emerald-500/30'
                }`}>
                  {incident.isActive && (
                    <div className="absolute top-0 right-0 p-4">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse ${
                        incident.type === 'DOWN' ? 'bg-red-500/10 border border-red-500/20 text-red-500' : 'bg-amber-500/10 border border-amber-500/20 text-amber-500'
                      }`}>
                        <AlertTriangle className="w-3 h-3" /> {incident.type === 'DOWN' ? t('alerts.active_outage') : t('alerts.active_degraded')}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link to={`/monitor/${incident.monitor.id}`} className="text-xl font-bold font-display text-white hover:text-orange-500 transition-colors">
                          {incident.monitor.name}
                        </Link>
                        <a href={incident.monitor.url} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-zinc-400">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono">
                        <div className={`font-bold flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${
                          incident.type === 'DOWN' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                          incident.type === 'DEGRADED' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                          'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        }`}>
                          {incident.type === 'DOWN' ? <XCircle className="w-3 h-3" /> : 
                           incident.type === 'DEGRADED' ? <AlertTriangle className="w-3 h-3" /> : 
                           <CheckCircle2 className="w-3 h-3" />}
                          {incident.type === 'DOWN' ? t('alerts.service_down') : 
                           incident.type === 'DEGRADED' ? t('alerts.performance_drop') : 
                           t('alerts.systems_recovered')}
                        </div>

                        {(incident.type === 'DOWN' || incident.type === 'DEGRADED') && incident.errorMessage && (
                          <div className="flex items-center gap-1.5 text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                            <Hash className="w-3 h-3" /> {incident.errorMessage}
                          </div>
                        )}
                        
                        {incident.type === 'UP' && incident.duration && (
                          <div className="flex items-center gap-1.5 text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                            <Clock className="w-3 h-3" /> {t('alerts.downtime')}: {incident.duration}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-zinc-500 ml-auto md:ml-0">
                          <Clock className="w-3 h-3" /> {formatDistanceToNow(incident.timestamp, { addSuffix: true })}
                          <span className="hidden sm:inline">({format(incident.timestamp, 'HH:mm:ss')})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0">
                      <Link 
                        to={`/monitor/${incident.monitor.id}`}
                        className="p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 rounded-xl text-zinc-400 hover:text-white transition-all shadow-lg"
                      >
                        <Activity className="w-5 h-5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
