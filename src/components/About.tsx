import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Globe, Shield, Zap, BarChart3, Bell, Users, Clock, Server, Cpu } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from '../lib/i18n';

export default function About() {
  const { t } = useTranslation();

  const values = [
    { icon: Shield, color: 'text-blue-500', bg: 'bg-blue-500/10', title: t('about.value1_title'), desc: t('about.value1_desc') },
    { icon: Zap, color: 'text-orange-500', bg: 'bg-orange-500/10', title: t('about.value2_title'), desc: t('about.value2_desc') },
    { icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10', title: t('about.value3_title'), desc: t('about.value3_desc') },
    { icon: Globe, color: 'text-emerald-500', bg: 'bg-emerald-500/10', title: t('about.value4_title'), desc: t('about.value4_desc') },
  ];

  const stats = [
    { value: '99.99%', label: t('about.stat1') },
    { value: '24/7', label: t('about.stat2') },
    { value: '<50ms', label: t('about.stat3') },
    { value: '10s', label: t('about.stat4') },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-500/5 blur-[150px] rounded-full -z-10" />

      <nav className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-white font-bold text-xl group">
          <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-display tracking-tight">Uptime<span className="text-orange-500">SaaS</span></span>
        </Link>
        <Link to="/auth" className="bg-white text-zinc-950 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105">
          {t('about.get_started')}
        </Link>
      </nav>

      <section className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 font-display text-white leading-[0.9]">
            {t('about.title_line1')}<br />
            <span className="text-zinc-600">{t('about.title_line2')}</span>
          </h1>
          <p className="text-xl text-zinc-500 max-w-3xl mx-auto leading-relaxed mb-16">
            {t('about.hero_desc')}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-32">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <div className="text-4xl font-black text-white mb-2 font-display">{stat.value}</div>
              <div className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-32">
        <h2 className="text-4xl font-black text-white mb-16 font-display tracking-tight text-center">{t('about.values_title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {values.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass p-10 rounded-[2.5rem] card-gradient group hover:border-zinc-700 transition-all"
            >
              <div className={`w-14 h-14 rounded-2xl ${v.bg} ${v.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <v.icon className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3 font-display">{v.title}</h3>
              <p className="text-zinc-500 leading-relaxed">{v.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="glass p-16 rounded-[3rem] border border-orange-500/10 card-gradient"
        >
          <h2 className="text-4xl font-black text-white mb-4 font-display">{t('about.cta_title')}</h2>
          <p className="text-zinc-500 text-lg mb-10 max-w-lg mx-auto">{t('about.cta_desc')}</p>
          <Link to="/auth" className="inline-flex items-center gap-3 bg-orange-500 text-white px-10 py-5 rounded-2xl font-black text-lg transition-all hover:scale-105 shadow-2xl shadow-orange-500/20">
            {t('about.cta_button')}
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
