import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Activity, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import api from '../lib/api';
import { useTranslation } from '../lib/i18n';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('auth.verify_invalid_token'));
      return;
    }

    const verify = async () => {
      try {
        const res = await api.get(`/auth/verify-email?token=${token}`);
        // Auto-login after verification
        login(res.data.token, res.data.user);
        setStatus('success');
        // Redirect to dashboard after 2 seconds
        setTimeout(() => navigate('/dashboard'), 2000);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.response?.data?.error || t('auth.verify_failed'));
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] blur-[120px] rounded-full -z-10 ${
        status === 'loading' ? 'bg-orange-500/5' :
        status === 'success' ? 'bg-emerald-500/5' : 'bg-red-500/5'
      }`} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        {/* Logo */}
        <Link to="/" className="inline-flex items-center gap-2.5 text-white font-bold text-xl mb-12 group">
          <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-display tracking-tight">Uptime<span className="text-orange-500">SaaS</span></span>
        </Link>

        {/* Status Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className={`inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-8 shadow-2xl ${
            status === 'loading' ? 'bg-orange-500 shadow-orange-500/20' :
            status === 'success' ? 'bg-emerald-500 shadow-emerald-500/20' :
            'bg-red-500 shadow-red-500/20'
          }`}
        >
          {status === 'loading' && <Loader2 className="w-12 h-12 text-white animate-spin" />}
          {status === 'success' && <CheckCircle2 className="w-12 h-12 text-white" />}
          {status === 'error' && <XCircle className="w-12 h-12 text-white" />}
        </motion.div>

        <h1 className="text-4xl font-black mb-3 font-display text-white tracking-tight">
          {status === 'loading' ? t('auth.verify_checking') :
           status === 'success' ? t('auth.verify_success_title') :
           t('auth.verify_error_title')}
        </h1>

        <p className="text-zinc-500 font-medium mb-10">
          {status === 'loading' ? t('auth.verify_wait') :
           status === 'success' ? t('auth.verify_success_desc') :
           message}
        </p>

        {status === 'error' && (
          <div className="glass rounded-[2rem] p-8 card-gradient space-y-4">
            <p className="text-zinc-400 text-sm">{t('auth.verify_error_help')}</p>
            <Link
              to="/auth"
              className="w-full bg-orange-500 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all hover:bg-orange-400"
            >
              {t('auth.back_to_login')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {status === 'success' && (
          <p className="text-emerald-500 text-sm font-bold animate-pulse">
            {t('auth.verify_redirecting')}
          </p>
        )}
      </motion.div>
    </div>
  );
}
