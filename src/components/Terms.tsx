import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from '../lib/i18n';

export default function Terms() {
  const { t } = useTranslation();
  const lastUpdated = '2026-05-01';

  const sections = [
    { title: t('terms.s1_title'), content: t('terms.s1_content') },
    { title: t('terms.s2_title'), content: t('terms.s2_content') },
    { title: t('terms.s3_title'), content: t('terms.s3_content') },
    { title: t('terms.s4_title'), content: t('terms.s4_content') },
    { title: t('terms.s5_title'), content: t('terms.s5_content') },
    { title: t('terms.s6_title'), content: t('terms.s6_content') },
    { title: t('terms.s7_title'), content: t('terms.s7_content') },
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-white font-bold text-xl group">
          <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-display tracking-tight">Uptime<span className="text-orange-500">SaaS</span></span>
        </Link>
      </nav>

      <section className="max-w-4xl mx-auto px-6 pt-12 pb-32">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-500/10 rounded-xl"><FileText className="w-5 h-5 text-orange-500" /></div>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('terms.last_updated')}: {lastUpdated}</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 font-display text-white">{t('terms.title')}</h1>
          <p className="text-lg text-zinc-500 leading-relaxed">{t('terms.intro')}</p>
        </motion.div>

        <div className="space-y-12">
          {sections.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass p-8 rounded-[2rem] card-gradient"
            >
              <h2 className="text-xl font-black text-white mb-4 font-display">{i + 1}. {s.title}</h2>
              <p className="text-zinc-400 leading-relaxed whitespace-pre-line">{s.content}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
