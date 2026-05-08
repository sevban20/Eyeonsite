import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Mail, MessageSquare, Send, MapPin, Phone, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useTranslation } from '../lib/i18n';

export default function Contact() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      toast.success(t('contact.success'));
      setForm({ name: '', email: '', subject: '', message: '' });
      setLoading(false);
    }, 1000);
  };

  const contactInfo = [
    { icon: Mail, label: t('contact.email_label'), value: 'support@uptimesaas.com' },
    { icon: Clock, label: t('contact.hours_label'), value: t('contact.hours_value') },
    { icon: MessageSquare, label: t('contact.response_label'), value: t('contact.response_value') },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-0 right-[20%] w-[600px] h-[600px] bg-purple-500/5 blur-[150px] rounded-full -z-10" />

      <nav className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-white font-bold text-xl group">
          <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-display tracking-tight">Uptime<span className="text-orange-500">SaaS</span></span>
        </Link>
      </nav>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-32">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-20">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 font-display text-white leading-[0.9]">
            {t('contact.title_line1')}<br />
            <span className="text-purple-500">{t('contact.title_line2')}</span>
          </h1>
          <p className="text-xl text-zinc-500 max-w-2xl mx-auto">{t('contact.subtitle')}</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3 glass p-10 rounded-[2.5rem] card-gradient"
          >
            <h2 className="text-2xl font-black text-white mb-8 font-display">{t('contact.form_title')}</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('contact.name')}</label>
                  <input
                    type="text" required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 focus:outline-none focus:border-purple-500 transition-colors text-sm font-bold text-white placeholder-zinc-700"
                    placeholder={t('contact.name_placeholder')}
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('contact.email')}</label>
                  <input
                    type="email" required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 focus:outline-none focus:border-purple-500 transition-colors text-sm font-bold text-white placeholder-zinc-700"
                    placeholder={t('contact.email_placeholder')}
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('contact.subject')}</label>
                <input
                  type="text" required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 focus:outline-none focus:border-purple-500 transition-colors text-sm font-bold text-white placeholder-zinc-700"
                  placeholder={t('contact.subject_placeholder')}
                  value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t('contact.message')}</label>
                <textarea
                  required rows={5}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 focus:outline-none focus:border-purple-500 transition-colors text-sm font-bold text-white placeholder-zinc-700 resize-none"
                  placeholder={t('contact.message_placeholder')}
                  value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                />
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <Send className="w-4 h-4" />
                {loading ? t('common.processing') : t('contact.send')}
              </button>
            </form>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 space-y-6"
          >
            {contactInfo.map((info, i) => (
              <div key={i} className="glass p-8 rounded-[2rem] card-gradient hover:border-zinc-700 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <info.icon className="w-6 h-6" />
                </div>
                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">{info.label}</div>
                <div className="text-white font-bold">{info.value}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>
    </div>
  );
}
