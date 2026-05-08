import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, BookOpen, Clock, ArrowRight, Tag } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from '../lib/i18n';

export default function Blog() {
  const { t } = useTranslation();

  const posts = [
    {
      slug: 'why-uptime-monitoring-matters',
      title: t('blog.post1_title'),
      excerpt: t('blog.post1_excerpt'),
      date: '2026-04-28',
      readTime: '5 min',
      tag: t('blog.tag_engineering'),
      color: 'orange',
    },
    {
      slug: 'introducing-ping-monitoring',
      title: t('blog.post2_title'),
      excerpt: t('blog.post2_excerpt'),
      date: '2026-05-01',
      readTime: '3 min',
      tag: t('blog.tag_product'),
      color: 'blue',
    },
    {
      slug: 'ssl-certificate-monitoring-best-practices',
      title: t('blog.post3_title'),
      excerpt: t('blog.post3_excerpt'),
      date: '2026-05-03',
      readTime: '7 min',
      tag: t('blog.tag_security'),
      color: 'emerald',
    },
    {
      slug: 'team-collaboration-workspaces',
      title: t('blog.post4_title'),
      excerpt: t('blog.post4_excerpt'),
      date: '2026-05-04',
      readTime: '4 min',
      tag: t('blog.tag_product'),
      color: 'purple',
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-500/5 blur-[150px] rounded-full -z-10" />

      <nav className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-white font-bold text-xl group">
          <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-display tracking-tight">Uptime<span className="text-orange-500">SaaS</span></span>
        </Link>
      </nav>

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-32">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-900 border border-zinc-800 text-emerald-500 text-[10px] font-bold uppercase tracking-[0.25em] mb-8">
            <BookOpen className="w-3.5 h-3.5" />
            {t('blog.badge')}
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 font-display text-white leading-[0.9]">
            {t('blog.title_line1')}<br />
            <span className="text-zinc-600">{t('blog.title_line2')}</span>
          </h1>
          <p className="text-xl text-zinc-500 max-w-2xl mx-auto">{t('blog.subtitle')}</p>
        </motion.div>

        <div className="space-y-8">
          {posts.map((post, i) => (
            <motion.article
              key={post.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-[2.5rem] p-10 card-gradient group hover:border-zinc-700 transition-all cursor-pointer"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-${post.color}-500/10 text-${post.color}-500 border border-${post.color}-500/20`}>
                      {post.tag}
                    </span>
                    <span className="flex items-center gap-1.5 text-zinc-600 text-xs">
                      <Clock className="w-3 h-3" />
                      {post.date}
                    </span>
                    <span className="text-zinc-700 text-xs">•</span>
                    <span className="text-zinc-600 text-xs">{post.readTime} {t('blog.read')}</span>
                  </div>
                  <h2 className="text-2xl font-black text-white mb-3 font-display group-hover:text-orange-500 transition-colors">{post.title}</h2>
                  <p className="text-zinc-500 leading-relaxed">{post.excerpt}</p>
                </div>
                <div className="shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 group-hover:bg-orange-500 flex items-center justify-center transition-all group-hover:scale-110">
                    <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  );
}
