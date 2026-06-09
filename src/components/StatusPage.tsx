import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { socket } from '../lib/socket';
import { Activity, CheckCircle2, XCircle, Globe, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../lib/i18n';

export default function StatusPage() {
  const { slug } = useParams();
  const [statusPage, setStatusPage] = useState<any>(null);
  const [monitors, setMonitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, language } = useTranslation();

  useEffect(() => {
    if (!slug) return;

    const fetchStatusPage = async () => {
      try {
        const res = await api.get(`/public-status/${slug}`);
        setStatusPage(res.data);
        setMonitors(res.data.monitors || []);
      } catch (err) {
        console.error('Error fetching public status page:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatusPage();

    const handleMonitorUpdated = (updatedMonitor: any) => {
      if (statusPage && updatedMonitor.workspaceId === statusPage.workspaceId) {
        setMonitors(prev => {
          if (prev.some(m => m.id === updatedMonitor.id)) {
            return prev.map(m => m.id === updatedMonitor.id ? {
              ...updatedMonitor,
              history: m.history,
              avgUptime: m.avgUptime
            } : m);
          }
          return prev;
        });
      }
    };

    const handleMonitorDeleted = (deletedMonitorId: string) => {
      setMonitors(prev => prev.filter(m => m.id !== deletedMonitorId));
    };

    socket.on('monitor-updated', handleMonitorUpdated);
    socket.on('monitor-deleted', handleMonitorDeleted);

    return () => {
      socket.off('monitor-updated', handleMonitorUpdated);
      socket.off('monitor-deleted', handleMonitorDeleted);
    };
  }, [slug, statusPage?.workspaceId]);

  if (loading) {
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

  const someDown = monitors.some(m => m.currentStatus === 'down' && m.status !== 'paused');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-orange-500/30">
      {/* Background Glow */}
      <div 
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] blur-[120px] rounded-full -z-10 opacity-20" 
        style={{ backgroundColor: statusPage?.themeColor || '#f97316' }}
      />

      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row items-center justify-between gap-8 mb-16"
        >
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/20"
            >
              <Activity className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-black font-display tracking-tight text-white">
                {statusPage?.title || t('status_pages.system_status')}
              </h1>
              {statusPage?.description && (
                <p className="text-zinc-500 font-medium text-sm mt-1">{statusPage.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t('status_pages.live_updates')}</span>
          </div>
        </motion.header>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`glass p-10 rounded-[3rem] mb-16 flex flex-col md:flex-row items-center gap-8 border relative overflow-hidden ${
            someDown ? 'border-red-500/20 bg-red-500/5' : 'border-green-500/20 bg-green-500/5'
          }`}
        >
          <div className={`absolute top-0 right-0 w-40 h-40 blur-[80px] -z-10 ${
            someDown ? 'bg-red-500/10' : 'bg-green-500/10'
          }`} />
          
          <div className={`p-6 rounded-[2rem] ${
            someDown ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
          }`}>
            {someDown ? (
              <AlertCircle className="w-16 h-16" />
            ) : (
              <ShieldCheck className="w-16 h-16" />
            )}
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-black mb-2 font-display tracking-tight text-white">
              {someDown ? t('status_page.some_issues') : t('status_page.all_operational')}
            </h2>
            <p className="text-zinc-400 font-medium leading-relaxed max-w-md">
              {someDown 
                ? t('status_pages.investigating_issues') 
                : t('status_pages.normal_parameters')}
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass border border-white/5 rounded-[3rem] overflow-hidden card-gradient shadow-2xl"
        >
          <div className="px-10 py-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-black text-white uppercase tracking-widest text-xs">{t('status_page.services')}</h3>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{monitors.length} {t('status_pages.total')}</span>
          </div>
          <div className="divide-y divide-white/5">
            {monitors.map((monitor, idx) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + (idx * 0.05) }}
                key={monitor.id} 
                className="px-10 py-8 flex flex-col gap-6 hover:bg-white/[0.02] transition-colors group/row"
              >
                {/* Top Row: Details & Status */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 group-hover/row:border-zinc-700 transition-colors">
                      <Globe className="w-6 h-6 text-zinc-500 group-hover/row:text-zinc-300 transition-colors" />
                    </div>
                    <div>
                      <span className="font-black text-xl text-white block mb-1">{monitor.name}</span>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{monitor.url}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${
                      monitor.status === 'paused' ? 'bg-zinc-800 text-zinc-500' :
                      monitor.currentStatus === 'up' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                      {monitor.status === 'paused' ? t('dashboard.paused').toUpperCase() : monitor.currentStatus === 'up' ? t('status_page.operational').toUpperCase() : monitor.currentStatus === 'degraded' ? t('status_page.degraded').toUpperCase() : t('status_page.down').toUpperCase()}
                    </div>
                    <div className={`w-3 h-3 rounded-full shadow-lg ${
                      monitor.status === 'paused' ? 'bg-zinc-700' :
                      monitor.currentStatus === 'up' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'
                    }`} />
                  </div>
                </div>

                {/* Bottom Row: Uptime History Bar */}
                {monitor.history && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-end gap-[2px] h-7 w-full">
                      {monitor.history.map((day: any, i: number) => {
                        let colorClass = 'bg-zinc-800'; // Default: no data
                        if (day.status === 'up') colorClass = 'bg-emerald-500';
                        else if (day.status === 'partial_down') colorClass = 'bg-amber-500';
                        else if (day.status === 'degraded') colorClass = 'bg-yellow-500';
                        else if (day.status === 'down') colorClass = 'bg-red-500';

                        const formattedDate = new Date(day.date).toLocaleDateString(
                          language === 'tr' ? 'tr-TR' : 'en-US',
                          { day: 'numeric', month: 'short', year: 'numeric' }
                        );

                        return (
                          <div
                            key={i}
                            className={`flex-1 rounded-sm relative group/bar cursor-pointer transition-all hover:scale-y-110 hover:opacity-85 ${colorClass}`}
                            style={{ height: day.status === 'nodata' ? '20%' : '100%' }}
                          >
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-zinc-900 border border-zinc-800 text-white text-[11px] px-3 py-2 rounded-xl opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-10 shadow-2xl">
                              <div className="font-bold mb-0.5">{formattedDate}</div>
                              <div className="text-zinc-400">
                                {day.status === 'nodata'
                                  ? t('dashboard.no_data')
                                  : t('monitor.uptime_desc').replace('{uptime}', day.uptime.toFixed(2))}
                              </div>
                              {day.down > 0 && (
                                <div className="text-red-400 mt-0.5 font-semibold">
                                  {t('monitor.failed_checks').replace('{count}', day.down.toString())}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                      <span>{t('monitor.90_days_ago')}</span>
                      <span className="text-zinc-400">{monitor.avgUptime !== undefined ? `${monitor.avgUptime}% ${t('monitor.uptime').toLowerCase()}` : ''}</span>
                      <span>{t('monitor.today')}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            {monitors.length === 0 && (
              <div className="p-20 text-center">
                <p className="text-zinc-500 font-medium italic">{t('status_page.no_monitors')}</p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-24 text-center"
        >
          <p className="text-zinc-600 text-sm font-medium">
            {t('status_page.powered_by')} <span className="text-orange-500 font-black uppercase tracking-widest ml-1">Eyeon.site</span>
          </p>
        </motion.footer>
      </div>
    </div>
  );
}
