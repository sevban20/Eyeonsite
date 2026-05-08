import React, { useState } from 'react';
import { Activity, Mail, Lock, User, ArrowRight, Chrome, Github, MailCheck, RefreshCw, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/auth';
import api from '../lib/api';
import { useTranslation } from '../lib/i18n';

type AuthView = 'login' | 'register' | 'verify_sent' | 'unverified' | 'forgot_password';

export default function Auth() {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const { login } = useAuth();
  const { t } = useTranslation();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (view === 'login') {
        const res = await api.post('/auth/login', { email, password });
        login(res.data.token, res.data.user);
      } else if (view === 'register') {
        const res = await api.post('/auth/register', { email, password, name });
        setView('verify_sent');
      } else if (view === 'forgot_password') {
        const res = await api.post('/auth/forgot-password', { email });
        setSuccess(res.data.message);
      }
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.unverified) {
        setUnverifiedEmail(data.email || email);
        setView('unverified');
      } else {
        setError(data?.error || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async (emailToResend: string) => {
    setResendLoading(true);
    setResendSent(false);
    try {
      await api.post('/auth/resend-verification', { email: emailToResend });
      setResendSent(true);
    } catch {
      // Silent — server always returns success for security
      setResendSent(true);
    } finally {
      setResendLoading(false);
    }
  };

  // ── Verification sent view ──────────────────────────────────────────────────
  if (view === 'verify_sent') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-orange-500/5 blur-[120px] rounded-full -z-10" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-500 text-white mb-8 shadow-2xl shadow-emerald-500/20">
            <MailCheck className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black mb-3 font-display text-white tracking-tight">{t('auth.verify_title')}</h1>
          <p className="text-zinc-500 font-medium mb-2">{t('auth.verify_subtitle')}</p>
          <p className="text-orange-500 font-bold text-sm mb-10">{email}</p>
          <div className="glass rounded-[2rem] p-8 card-gradient">
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">{t('auth.verify_desc')}</p>
            <button
              onClick={() => handleResendVerification(email)}
              disabled={resendLoading || resendSent}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${resendLoading ? 'animate-spin' : ''}`} />
              {resendSent ? t('auth.verify_resent') : resendLoading ? t('common.processing') : t('auth.verify_resend')}
            </button>
            <button onClick={() => setView('login')} className="w-full mt-3 text-zinc-600 hover:text-zinc-400 text-sm font-medium py-2 transition-colors">
              ← {t('auth.back_to_login')}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Unverified account view ─────────────────────────────────────────────────
  if (view === 'unverified') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-amber-500/5 blur-[120px] rounded-full -z-10" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-500 text-white mb-8 shadow-2xl shadow-amber-500/20">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black mb-3 font-display text-white tracking-tight">{t('auth.unverified_title')}</h1>
          <p className="text-zinc-500 font-medium mb-10">{t('auth.unverified_subtitle')}</p>
          <div className="glass rounded-[2rem] p-8 card-gradient">
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              {t('auth.unverified_desc')} <span className="text-orange-500 font-bold">{unverifiedEmail}</span>
            </p>
            {resendSent && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold text-center">
                {t('auth.verify_resent')}
              </div>
            )}
            <button
              onClick={() => handleResendVerification(unverifiedEmail)}
              disabled={resendLoading || resendSent}
              className="w-full bg-amber-500 hover:bg-amber-400 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${resendLoading ? 'animate-spin' : ''}`} />
              {resendSent ? t('auth.verify_resent') : resendLoading ? t('common.processing') : t('auth.unverified_resend')}
            </button>
            <button onClick={() => setView('login')} className="w-full mt-3 text-zinc-600 hover:text-zinc-400 text-sm font-medium py-2 transition-colors">
              ← {t('auth.back_to_login')}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Login / Register view ───────────────────────────────────────────────────
  const isLogin = view === 'login';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-orange-500/5 blur-[120px] rounded-full -z-10" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-orange-500 text-white mb-8 shadow-2xl shadow-orange-500/20"
          >
            <Activity className="w-10 h-10" />
          </motion.div>
          <h1 className="text-4xl font-bold mb-3 font-display text-white tracking-tight">
            {isLogin ? t('auth.welcome_back') : t('auth.create_account')}
          </h1>
          <p className="text-zinc-500 font-medium">{t('auth.subtitle')}</p>
        </div>

        <div className="glass rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden card-gradient">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <AnimatePresence mode="wait">
              {(error || success) && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`mb-8 p-4 border rounded-2xl text-xs font-bold uppercase tracking-wider text-center ${
                    error ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                  }`}
                >
                  {error || success}
                </motion.div>
              )}
            </AnimatePresence>

            {view === 'forgot_password' ? (
              <div className="space-y-4">
                <p className="text-zinc-400 text-sm mb-6">{t('auth.forgot_desc')}</p>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                  <input 
                    type="email" 
                    required
                    placeholder={t('auth.email')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading || !!success}
                  className="w-full bg-white text-zinc-950 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/5 disabled:opacity-50"
                >
                  {loading ? t('common.processing') : t('auth.send_reset_link')}
                  <ArrowRight className="w-6 h-6" />
                </button>
                <button 
                  type="button"
                  onClick={() => { setView('login'); setSuccess(''); setError(''); }}
                  className="w-full text-zinc-500 hover:text-zinc-300 text-sm font-bold transition-colors py-2"
                >
                  ← {t('auth.back_to_login')}
                </button>
              </div>
            ) : (
              <>
                <AnimatePresence mode="popLayout">
                  {!isLogin && (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="relative"
                    >
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                      <input 
                        type="text" 
                        required
                        placeholder={t('auth.full_name')}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                        value={name}
                        onChange={e => setName(e.target.value)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                  <input 
                    type="email" 
                    required
                    placeholder={t('auth.email')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                  <input 
                    type="password" 
                    required
                    minLength={8}
                    placeholder={t('auth.password')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
                {!isLogin && (
                  <p className="text-[10px] text-zinc-600 pl-2">{t('auth.password_hint')}</p>
                )}
                {isLogin && (
                  <div className="flex justify-end pr-2">
                    <button 
                      type="button"
                      onClick={() => { setView('forgot_password'); setError(''); setSuccess(''); }}
                      className="text-xs font-bold text-zinc-600 hover:text-orange-500 transition-colors"
                    >
                      {t('auth.forgot_password')}
                    </button>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-zinc-950 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/5 mt-4 disabled:opacity-50 disabled:scale-100"
                >
                  {loading ? t('common.processing') : isLogin ? t('auth.sign_in') : t('auth.get_started')}
                  <ArrowRight className="w-6 h-6" />
                </button>
              </>
            )}
          </form>

          {/* Social auth — OAuth infrastructure ready, UI disabled until keys configured */}
          <div className="mt-10 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-black">
              <span className="bg-zinc-950 px-4 text-zinc-600">{t('auth.or_continue')}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="relative group">
              <button 
                disabled
                className="w-full flex items-center justify-center gap-3 bg-zinc-950 border border-zinc-800 py-4 rounded-2xl font-bold text-sm opacity-40 cursor-not-allowed"
                title={t('auth.coming_soon')}
              >
                <Chrome className="w-5 h-5 text-zinc-500" />
                Google
              </button>
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[9px] font-black uppercase tracking-widest rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {t('auth.coming_soon')}
              </span>
            </div>
            <div className="relative group">
              <button 
                disabled
                className="w-full flex items-center justify-center gap-3 bg-zinc-950 border border-zinc-800 py-4 rounded-2xl font-bold text-sm opacity-40 cursor-not-allowed"
                title={t('auth.coming_soon')}
              >
                <Github className="w-5 h-5 text-zinc-500" />
                GitHub
              </button>
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[9px] font-black uppercase tracking-widest rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {t('auth.coming_soon')}
              </span>
            </div>
          </div>

          <p className="mt-10 text-center text-sm font-medium text-zinc-500">
            {isLogin ? t('auth.no_account') : t('auth.have_account')}{' '}
            <button 
              onClick={() => { setView(isLogin ? 'register' : 'login'); setError(''); }}
              className="text-orange-500 font-black hover:text-orange-400 transition-colors ml-1"
            >
              {isLogin ? t('auth.sign_up') : t('auth.sign_in')}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
