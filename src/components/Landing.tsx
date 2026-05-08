import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Shield, Zap, Globe, ArrowRight, CheckCircle2, BarChart3, Bell, Monitor, Cpu, Lock, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from '../lib/i18n';

export default function Landing() {
  const { t } = useTranslation();

  return (
    <div className="relative overflow-hidden bg-zinc-950">
      {/* Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-orange-500/5 blur-[150px] rounded-full -z-10" />
      <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full -z-10" />
      
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-40 pb-32 text-center relative">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-900 border border-zinc-800 text-orange-500 text-[10px] font-bold uppercase tracking-[0.25em] mb-12 shadow-2xl"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          {t('landing.badge')}
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-7xl md:text-[10rem] font-black tracking-tighter mb-10 leading-[0.8] font-display text-white"
        >
          {t('landing.hero_line1')} <br />
          <span className="text-orange-500">{t('landing.hero_line2')}</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-2xl mx-auto text-zinc-500 text-xl md:text-2xl mb-16 leading-relaxed font-light"
        >
          {t('landing.hero_desc')}
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6"
        >
          <Link 
            to="/auth" 
            className="w-full sm:w-auto bg-white text-zinc-950 px-10 py-5 rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-white/5"
          >
            {t('landing.cta_start')}
            <ArrowRight className="w-6 h-6" />
          </Link>
          <a 
            href="#features" 
            className="w-full sm:w-auto px-10 py-5 rounded-[2rem] font-bold text-xl text-zinc-400 hover:text-white transition-all border border-zinc-800 hover:bg-zinc-900"
          >
            {t('landing.cta_learn')}
          </a>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="max-w-6xl mx-auto px-6 py-24 border-y border-zinc-900 grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
        {[
          { label: t('landing.stat_uptime'), value: '99.99%' },
          { label: t('landing.stat_latency'), value: '< 10ms' },
          { label: t('landing.stat_active'), value: '24/7' },
          { label: t('landing.stat_tracked'), value: '50k+' }
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="text-4xl font-bold text-white mb-2 font-display">{stat.value}</div>
            <div className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">{stat.label}</div>
          </motion.div>
        ))}
      </section>

      {/* Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-40">
        <div className="flex flex-col md:flex-row items-end justify-between gap-8 mb-24">
          <div className="max-w-2xl">
            <h2 className="text-5xl md:text-7xl font-bold mb-6 tracking-tighter font-display text-white leading-none">
              {t('landing.features_title1')} <br />
              <span className="text-zinc-700">{t('landing.features_title2')}</span>
            </h2>
            <p className="text-zinc-500 text-xl">{t('landing.features_desc')}</p>
          </div>
          <div className="hidden md:block h-[1px] flex-1 bg-zinc-900 mx-12 mb-4" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: t('landing.feature_http_title'), desc: t('landing.feature_http_desc'), icon: Globe, color: 'text-orange-500', bg: 'bg-orange-500/10' },
            { title: t('landing.feature_alerts_title'), desc: t('landing.feature_alerts_desc'), icon: Bell, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { title: t('landing.feature_analytics_title'), desc: t('landing.feature_analytics_desc'), icon: BarChart3, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
          ].map((feature, i) => (
            <motion.div 
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass p-10 rounded-[3rem] hover:border-zinc-700 transition-all group card-gradient"
            >
              <div className={`w-14 h-14 rounded-2xl ${feature.bg} ${feature.color} flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 font-display text-white">{feature.title}</h3>
              <p className="text-zinc-500 leading-relaxed text-lg font-light">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-24 border-t border-zinc-900">
        <div className="flex flex-col md:flex-row items-start justify-between gap-12 mb-20">
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-white font-bold text-2xl">
              <div className="p-2 bg-orange-500 rounded-xl">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <span className="font-display flex items-center gap-0">
                Eye
                <span className="relative flex items-center justify-center mx-0.5">
                  <Eye className="w-6 h-6 text-orange-500 stroke-[3]" />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_white]" 
                  />
                </span>
                n<span className="text-orange-500">.site</span>
              </span>
            </div>
            <p className="max-w-xs text-zinc-500 text-sm leading-relaxed">
              {t('landing.footer_brand_desc')}
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-16">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-widest">{t('landing.footer_product')}</h4>
              <ul className="space-y-2 text-sm text-zinc-500">
                <li><a href="#features" className="hover:text-orange-500 transition-colors">{t('landing.footer_features')}</a></li>
                <li><Link to="/pricing" className="hover:text-orange-500 transition-colors">{t('landing.footer_pricing')}</Link></li>
                <li><Link to="/blog" className="hover:text-orange-500 transition-colors">{t('landing.footer_status_page')}</Link></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-widest">{t('landing.footer_company')}</h4>
              <ul className="space-y-2 text-sm text-zinc-500">
                <li><Link to="/about" className="hover:text-orange-500 transition-colors">{t('landing.footer_about')}</Link></li>
                <li><Link to="/blog" className="hover:text-orange-500 transition-colors">{t('landing.footer_blog')}</Link></li>
                <li><Link to="/contact" className="hover:text-orange-500 transition-colors">{t('landing.footer_contact')}</Link></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-widest">{t('landing.footer_legal')}</h4>
              <ul className="space-y-2 text-sm text-zinc-500">
                <li><Link to="/privacy" className="hover:text-orange-500 transition-colors">{t('landing.footer_privacy')}</Link></li>
                <li><Link to="/terms" className="hover:text-orange-500 transition-colors">{t('landing.footer_terms')}</Link></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-12 border-t border-zinc-900/50">
          <div className="text-xs text-zinc-600 font-medium">
            {t('landing.footer_copyright')}
          </div>
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('landing.footer_operational')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
