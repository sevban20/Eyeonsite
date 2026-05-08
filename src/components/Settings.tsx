import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Briefcase, Mail, Type, Lock, CheckCircle2, Save, Server, Hash, Users, UserPlus, Trash2, Crown, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useTranslation } from '../lib/i18n';

export default function Settings({ user, workspace }: { user: any; workspace: any }) {
  const { t } = useTranslation();
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: ''
  });
  const [workspaceForm, setWorkspaceForm] = useState({
    name: workspace?.name || '',
    smtpHost: workspace?.smtpHost || '',
    smtpPort: workspace?.smtpPort || '',
    smtpUser: workspace?.smtpUser || '',
    smtpPass: workspace?.smtpPass || '',
    smtpFrom: workspace?.smtpFrom || '',
    telegramBotToken: workspace?.telegramBotToken || ''
  });
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    if (workspace?.id) {
      fetchMembers();
    }
  }, [workspace?.id]);

  const fetchMembers = async () => {
    try {
      const res = await api.get(`/workspaces/${workspace.id}/members`);
      setMembers(res.data);
    } catch (err) {
      console.error('Failed to fetch members', err);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      const res = await api.post(`/workspaces/${workspace.id}/members`, { email: inviteEmail });
      setMembers([...members, res.data]);
      setInviteEmail('');
      toast.success(t('settings.team_added'));
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to add member';
      if (msg === 'User not found') toast.error(t('settings.team_user_not_found'));
      else if (msg === 'User is already a member') toast.error(t('settings.team_already_member'));
      else if (msg === 'User is already the owner') toast.error(t('settings.team_already_owner'));
      else toast.error(msg);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await api.delete(`/workspaces/${workspace.id}/members/${memberId}`);
      setMembers(members.filter(m => m.memberId !== memberId));
      toast.success(t('settings.team_removed'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/user', profileForm);
      toast.success('Profile settings successfully updated', {
        description: 'Your changes have been securely saved.'
      });
      // Clear password field after success
      setProfileForm({ ...profileForm, password: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update user profile');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    setLoading(true);
    try {
      await api.put(`/workspaces/${workspace.id}`, workspaceForm);
      toast.success('Workspace successfully updated', {
        description: 'Changes apply across your organization immediately.'
      });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 pt-12 pb-24">
      <header className="mb-12">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-orange-500 font-bold text-xs uppercase tracking-[0.2em] mb-3"
        >
          <SettingsIcon className="w-4 h-4" />
          {t('settings.label')}
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl font-bold tracking-tight text-white mb-2 font-display"
        >
          {t('settings.title')}
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-zinc-500 text-lg"
        >
          {t('settings.subtitle')}
        </motion.p>
      </header>

      <div className="space-y-12">
        {/* Workspace Settings */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass p-8 md:p-12 rounded-[2.5rem] border border-white/5 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] -z-10 group-hover:scale-110 transition-transform duration-700" />
          
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-zinc-800 rounded-2xl">
              <Briefcase className="w-6 h-6 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">{t('settings.workspace_title')}</h2>
              <p className="text-sm text-zinc-500 font-medium">{t('settings.workspace_desc')}</p>
            </div>
          </div>

          <form onSubmit={handleWorkspaceUpdate} className="space-y-6">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('settings.workspace_name')}</label>
              <div className="relative">
                <Type className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                <input 
                  type="text" 
                  required
                  placeholder="e.g. My Organization"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold text-white placeholder-zinc-700"
                  value={workspaceForm.name}
                  onChange={(e) => setWorkspaceForm({...workspaceForm, name: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-8 mt-8 border-t border-white/5 space-y-6">
              <div>
                <h3 className="text-lg font-black text-white mb-1">{t('settings.smtp_title')}</h3>
                <p className="text-xs text-zinc-500 font-medium">{t('settings.smtp_desc')}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('settings.smtp_host')}</label>
                  <div className="relative">
                    <Server className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                    <input 
                      type="text" 
                      placeholder="smtp.example.com"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold text-white placeholder-zinc-700"
                      value={workspaceForm.smtpHost}
                      onChange={(e) => setWorkspaceForm({...workspaceForm, smtpHost: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('settings.smtp_port')}</label>
                  <div className="relative">
                    <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                    <input 
                      type="number" 
                      placeholder="587"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold text-white placeholder-zinc-700"
                      value={workspaceForm.smtpPort}
                      onChange={(e) => setWorkspaceForm({...workspaceForm, smtpPort: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">SMTP Username</label>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                    <input 
                      type="text" 
                      placeholder="user@example.com"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold text-white placeholder-zinc-700"
                      value={workspaceForm.smtpUser}
                      onChange={(e) => setWorkspaceForm({...workspaceForm, smtpUser: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">SMTP Password</label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold text-white placeholder-zinc-700"
                      value={workspaceForm.smtpPass}
                      onChange={(e) => setWorkspaceForm({...workspaceForm, smtpPass: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">From Address</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                  <input 
                    type="email" 
                    placeholder="alerts@mycompany.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold text-white placeholder-zinc-700"
                    value={workspaceForm.smtpFrom}
                    onChange={(e) => setWorkspaceForm({...workspaceForm, smtpFrom: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="pt-8 mt-8 border-t border-white/5 space-y-6">
              <div>
                <h3 className="text-lg font-black text-white mb-1">{t('settings.telegram_title')}</h3>
                <p className="text-xs text-zinc-500 font-medium">{t('settings.telegram_desc')}</p>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('settings.telegram_token')}</label>
                <div className="relative">
                  <Type className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                  <input 
                    type="password" 
                    placeholder="123456789:ABCDEF..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-[#0088cc] transition-colors text-sm font-bold text-white placeholder-zinc-700"
                    value={workspaceForm.telegramBotToken}
                    onChange={(e) => setWorkspaceForm({...workspaceForm, telegramBotToken: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                type="submit"
                disabled={loading}
                className="bg-white text-zinc-950 px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-3"
              >
                <Save className="w-4 h-4" />
                {t('settings.update_workspace')}
              </button>
            </div>
          </form>
        </motion.section>

        {/* Team Management */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass p-8 md:p-12 rounded-[2.5rem] border border-white/5 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[100px] -z-10 group-hover:scale-110 transition-transform duration-700" />
          
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-zinc-800 rounded-2xl">
              <Users className="w-6 h-6 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">{t('settings.team_title')}</h2>
              <p className="text-sm text-zinc-500 font-medium">{t('settings.team_desc')}</p>
            </div>
          </div>

          {/* Current Members List */}
          <div className="space-y-3 mb-8">
            {members.length === 0 ? (
              <div className="text-center py-10 text-zinc-600 text-sm italic">{t('settings.team_no_members')}</div>
            ) : (
              members.map((member: any) => (
                <div
                  key={member.memberId}
                  className="flex items-center justify-between bg-zinc-950/50 border border-zinc-800/50 rounded-2xl px-6 py-4 group/member hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black uppercase ${
                      member.role === 'OWNER' ? 'bg-orange-500/10 text-orange-500' : 'bg-purple-500/10 text-purple-400'
                    }`}>
                      {member.name ? member.name.charAt(0) : member.email.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{member.name || member.email}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          member.role === 'OWNER' 
                            ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' 
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}>
                          {member.role === 'OWNER' ? t('settings.team_role_owner') : t('settings.team_role_admin')}
                        </span>
                      </div>
                      {member.name && <p className="text-xs text-zinc-500 font-mono mt-0.5">{member.email}</p>}
                    </div>
                  </div>
                  {member.role !== 'OWNER' && (
                    <button
                      onClick={() => handleRemoveMember(member.memberId)}
                      className="opacity-0 group-hover/member:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 p-2 rounded-xl hover:bg-red-500/10"
                      title={t('settings.team_remove')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Invite Form */}
          <div className="pt-6 border-t border-white/5">
            <div className="mb-4">
              <h3 className="text-lg font-black text-white mb-1">{t('settings.team_invite')}</h3>
              <p className="text-xs text-zinc-500 font-medium">{t('settings.team_invite_desc')}</p>
            </div>
            <form onSubmit={handleInvite} className="flex gap-3">
              <div className="relative flex-1">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                <input
                  type="email"
                  required
                  placeholder={t('settings.team_email_placeholder')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-purple-500 transition-colors text-sm font-bold text-white placeholder-zinc-700"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={inviteLoading}
                className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-3 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                {t('settings.team_add')}
              </button>
            </form>
          </div>
        </motion.section>

        {/* Profile Settings */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass p-8 md:p-12 rounded-[2.5rem] border border-white/5 relative overflow-hidden"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-zinc-800 rounded-2xl">
              <User className="w-6 h-6 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">{t('settings.profile_title')}</h2>
              <p className="text-sm text-zinc-500 font-medium">{t('settings.profile_desc')}</p>
            </div>
          </div>

          <form onSubmit={handleProfileUpdate} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('settings.full_name')}</label>
                <div className="relative">
                  <Type className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                  <input 
                    type="text" 
                    placeholder="Your Name"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold text-white placeholder-zinc-700"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('settings.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                  <input 
                    type="email" 
                    required
                    placeholder="name@example.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold text-white placeholder-zinc-700"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('settings.password')}</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                <input 
                  type="password" 
                  placeholder={t('settings.password_placeholder')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-bold text-white placeholder-zinc-700"
                  value={profileForm.password}
                  onChange={(e) => setProfileForm({...profileForm, password: e.target.value})}
                />
              </div>
              <p className="text-zinc-600 text-xs italic">Only fill this if you want to set a new password.</p>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                type="submit"
                disabled={loading}
                className="bg-white text-zinc-950 px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-3"
              >
                <CheckCircle2 className="w-4 h-4" />
                {t('settings.update_profile')}
              </button>
            </div>
          </form>
        </motion.section>
      </div>
    </div>
  );
}
