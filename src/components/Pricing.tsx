import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Check, ArrowRight, Zap, Shield, Globe, Users, Headphones, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from '../lib/i18n';

export default function Pricing() {
  const { t } = useTranslation();

  const plans = [
    {
      name: t('pricing.free_name'),
      price: '$0',
      period: t('pricing.forever'),
      desc: t('pricing.free_desc'),
      color: 'zinc',
      features: [
        t('pricing.free_f1'),
        t('pricing.free_f2'),
        t('pricing.free_f3'),
        t('pricing.free_f4'),
        t('pricing.free_f5'),
      ],
      cta: t('pricing.free_cta'),
      popular: false,
    },
    {
      name: t('pricing.pro_name'),
      price: '$29',
      period: t('pricing.per_month'),
      desc: t('pricing.pro_desc'),
      color: 'orange',
      features: [
        t('pricing.pro_f1'),
        t('pricing.pro_f2'),
        t('pricing.pro_f3'),
        t('pricing.pro_f4'),
        t('pricing.pro_f5'),
        t('pricing.pro_f6'),
        t('pricing.pro_f7'),
      ],
      cta: t('pricing.pro_cta'),
      popular: true,
    },
    {
      name: t('pricing.enterprise_name'),
      price: t('pricing.enterprise_price'),
      period: '',
      desc: t('pricing.enterprise_desc'),
      color: 'purple',
      features: [
        t('pricing.ent_f1'),
        t('pricing.ent_f2'),
        t('pricing.ent_f3'),
        t('pricing.ent_f4'),
        t('pricing.ent_f5'),
        t('pricing.ent_f6'),
      ],
      cta: t('pricing.enterprise_cta'),
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-orange-500/5 blur-[150px] rounded-full -z-10" />

      {/* Navbar */}
      <nav className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-white font-bold text-xl group">
          <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-display tracking-tight">Uptime<span className="text-orange-500">SaaS</span></span>
        </Link>
        <Link to="/auth" className="bg-white text-zinc-950 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105">
          {t('pricing.get_started')}
        </Link>
      </nav>

      <section className="max-w-7xl mx-auto px-6 pt-20 pb-32">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-900 border border-zinc-800 text-orange-500 text-[10px] font-bold uppercase tracking-[0.25em] mb-8">
            <Zap className="w-3.5 h-3.5 fill-current" />
            {t('pricing.badge')}
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 font-display text-white leading-[0.9]">
            {t('pricing.title_line1')}<br />
            <span className="text-orange-500">{t('pricing.title_line2')}</span>
          </h1>
          <p className="text-xl text-zinc-500 max-w-2xl mx-auto">{t('pricing.subtitle')}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative glass rounded-[2.5rem] p-10 card-gradient flex flex-col ${
                plan.popular ? 'border-orange-500/30 ring-1 ring-orange-500/20 scale-105' : 'border-white/5'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-orange-500 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/30">
                  {t('pricing.most_popular')}
                </div>
              )}
              <div className="mb-8">
                <h3 className="text-lg font-black text-white uppercase tracking-widest mb-3">{plan.name}</h3>
                <div className="flex items-end gap-2 mb-3">
                  <span className="text-5xl font-black text-white font-display">{plan.price}</span>
                  {plan.period && <span className="text-zinc-500 font-bold text-sm mb-1">{plan.period}</span>}
                </div>
                <p className="text-zinc-500 text-sm">{plan.desc}</p>
              </div>
              <div className="space-y-4 flex-1 mb-10">
                {plan.features.map((f, j) => (
                  <div key={j} className="flex items-start gap-3">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.popular ? 'text-orange-500' : 'text-zinc-500'}`} />
                    <span className="text-sm text-zinc-300">{f}</span>
                  </div>
                ))}
              </div>
              <Link
                to="/auth"
                className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest text-center transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 ${
                  plan.popular
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'bg-zinc-800 text-white hover:bg-zinc-700'
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
