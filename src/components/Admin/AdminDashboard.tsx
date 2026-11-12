import React, { useState, useEffect } from 'react';
import { Users, Activity, LayoutTemplate, ShieldAlert, CheckCircle, Ban, Gift, Server, TerminalSquare, Crown } from 'lucide-react';
import api from '../../lib/api';
import { toast } from 'sonner';
import { useTranslation } from '../../lib/i18n';

export default function AdminDashboard() {
  const { t, language, apiError } = useTranslation();
  const [stats, setStats] = useState({ totalUsers: 0, totalMonitors: 0, activeMonitors: 0, totalWorkspaces: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'logs'>('overview');
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchLogs();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (error) {
      toast.error(t('admin.load_stats_failed'));
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
      setLoading(false);
    } catch (error) {
      toast.error(t('admin.load_users_failed'));
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await api.get('/admin/logs');
      setLogs(res.data.logs);
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleBlock = async (userId: string, currentStatus: boolean) => {
    if (!currentStatus && !window.confirm(t('admin.confirm_block'))) return;
    try {
      await api.post(`/admin/users/${userId}/block`, { isBlocked: !currentStatus });
      toast.success(currentStatus ? t('admin.user_unblocked') : t('admin.user_blocked'));
      fetchUsers();
    } catch (error) {
      toast.error(t('admin.status_failed'));
    }
  };

  const handleGiftSubscription = async (userId: string, plan: string) => {
    try {
      // Give PRO for 1 month
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      
      await api.post(`/admin/users/${userId}/subscription`, { plan, expiresAt: expiresAt.toISOString() });
      toast.success(t('admin.plan_changed').replace('{plan}', plan));
      fetchUsers();
    } catch (error) {
      toast.error(t('admin.plan_failed'));
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'SYSTEM_ADMIN' ? 'USER' : 'SYSTEM_ADMIN';
    try {
      await api.post(`/admin/users/${userId}/role`, { role: newRole });
      toast.success(newRole === 'SYSTEM_ADMIN' ? t('admin.promoted') : t('admin.demoted'));
      fetchUsers();
    } catch (error: any) {
      toast.error(apiError(error, 'admin.role_failed'));
    }
  };

  if (loading) return <div className="p-8 text-zinc-400">{t('admin.loading')}</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white tracking-tight">{t('admin.title')}</h1>
        <div className="flex space-x-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {t('admin.tab_overview')}
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {t('admin.tab_users')}
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'logs' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {t('admin.tab_logs')}
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Users className="w-16 h-16" />
            </div>
            <p className="text-sm font-medium text-zinc-400 mb-1">{t('admin.total_users')}</p>
            <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
          </div>
          
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <LayoutTemplate className="w-16 h-16" />
            </div>
            <p className="text-sm font-medium text-zinc-400 mb-1">{t('admin.workspaces')}</p>
            <p className="text-3xl font-bold text-white">{stats.totalWorkspaces}</p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Server className="w-16 h-16" />
            </div>
            <p className="text-sm font-medium text-zinc-400 mb-1">{t('admin.total_monitors')}</p>
            <p className="text-3xl font-bold text-white">{stats.totalMonitors}</p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Activity className="w-16 h-16" />
            </div>
            <p className="text-sm font-medium text-zinc-400 mb-1">{t('admin.active_monitors')}</p>
            <p className="text-3xl font-bold text-green-500">{stats.activeMonitors}</p>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-900">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('admin.col_user')}</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('admin.col_plan')}</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('admin.workspaces')}</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('admin.col_status')}</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('admin.col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center text-orange-500 font-bold uppercase">
                        {u.email[0]}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-white">{u.name || t('admin.no_name')}</div>
                        <div className="text-sm text-zinc-400">{u.email}</div>
                        {u.role === 'SYSTEM_ADMIN' && <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400">{t('admin.badge_admin')}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.subscriptionPlan === 'PRO' ? 'bg-orange-500/10 text-orange-400' : 'bg-zinc-800 text-zinc-300'}`}>
                      {u.subscriptionPlan || 'FREE'}
                    </span>
                    {u.subscriptionExpires && <div className="text-xs text-zinc-500 mt-1">{t('admin.expires')}: {new Date(u.subscriptionExpires).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                    {u._count.workspaces}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {u.isBlocked ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
                        <Ban className="w-3 h-3 mr-1" /> {t('admin.blocked')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                        <CheckCircle className="w-3 h-3 mr-1" /> {t('admin.active')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    <button
                      onClick={() => handleToggleRole(u.id, u.role)}
                      className={`${u.role === 'SYSTEM_ADMIN' ? 'text-purple-400 hover:text-purple-300' : 'text-zinc-500 hover:text-purple-400'} transition-colors`}
                      title={u.role === 'SYSTEM_ADMIN' ? t('admin.remove_admin') : t('admin.make_admin')}
                    >
                      <Crown className="w-4 h-4 inline" />
                    </button>
                    <button
                      onClick={() => handleGiftSubscription(u.id, u.subscriptionPlan === 'PRO' ? 'FREE' : 'PRO')}
                      className="text-orange-500 hover:text-orange-400 transition-colors"
                      title={t('admin.toggle_pro')}
                    >
                      <Gift className="w-4 h-4 inline" />
                    </button>
                    {u.role !== 'SYSTEM_ADMIN' && (
                      <button
                        onClick={() => handleToggleBlock(u.id, u.isBlocked)}
                        className={`${u.isBlocked ? 'text-zinc-400 hover:text-white' : 'text-red-500 hover:text-red-400'} transition-colors`}
                        title={u.isBlocked ? t('admin.unblock_user') : t('admin.block_user')}
                      >
                        <ShieldAlert className="w-4 h-4 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-black border border-zinc-800 rounded-xl p-4 font-mono text-sm overflow-hidden flex flex-col h-[600px]">
          <div className="flex items-center space-x-2 mb-4 text-zinc-400 pb-4 border-b border-zinc-800">
            <TerminalSquare className="w-5 h-5" />
            <span>{t('admin.logs_title')}</span>
            <button onClick={fetchLogs} className="ml-auto text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded text-white transition-colors">{t('admin.refresh')}</button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <div className="text-zinc-600">{t('admin.no_logs')}</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-green-500/80 hover:bg-zinc-900/50 px-2 py-0.5 rounded break-all">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
