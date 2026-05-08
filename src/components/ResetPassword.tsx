import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Activity, Lock, ArrowRight, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../lib/api';
import { useTranslation } from '../lib/i18n';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('auth.passwords_dont_match'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.password_too_short'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setStatus('success');
      setTimeout(() => navigate('/auth'), 3000);
    } catch (err: any) {
      setStatus('error');
      setError(err.response?.data?.error || t('auth.reset_failed'));
    } finally {
      setLoading(false);
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-500/5 blur-[120px] rounded-full -z-10" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-500 text-white mb-8 shadow-2xl shadow-emerald-500/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black mb-3 font-display text-white tracking-tight">{t('auth.reset_success_title')}</h1>
          <p className="text-zinc-500 font-medium mb-10">{t('auth.reset_success_desc')}</p>
          <Link to="/auth" className="text-orange-500 font-bold hover:text-orange-400 transition-colors">
            {t('auth.back_to_login')} →
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-orange-500/5 blur-[120px] rounded-full -z-10" />
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500 text-white mb-6 shadow-xl shadow-orange-500/20">
            <Activity className="w-8 h-8" />
          </Link>
          <h1 className="text-3xl font-bold mb-3 font-display text-white tracking-tight">{t('auth.reset_password_title')}</h1>
          <p className="text-zinc-500 font-medium">{t('auth.reset_password_subtitle')}</p>
        </div>

        <div className="glass rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden card-gradient">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold uppercase text-center">
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {!token ? (
            <div className="text-center py-4">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <p className="text-zinc-400 text-sm mb-6">{t('auth.reset_invalid_token')}</p>
              <Link to="/auth" className="text-orange-500 font-bold hover:text-orange-400 underline decoration-2 underline-offset-4 transition-all">
                {t('auth.back_to_login')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                <input 
                  type="password" 
                  required
                  placeholder={t('auth.new_password')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                <input 
                  type="password" 
                  required
                  placeholder={t('auth.confirm_new_password')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-white text-zinc-950 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/5 mt-4 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : t('auth.reset_password_button')}
                {!loading && <ArrowRight className="w-6 h-6" />}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
