import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Plus, Link as LinkIcon, Settings, Trash2, CheckCircle2, Activity } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';

import { useTranslation } from '../lib/i18n';

export default function StatusPagesList({ workspace }: any) {
  const { t } = useTranslation();
  const [pages, setPages] = useState<any[]>([]);
  const [monitors, setMonitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    slug: '',
    themeColor: '#f97316',
    monitorIds: [] as string[]
  });

  useEffect(() => {
    if (!workspace) return;
    const fetchData = async () => {
      try {
        const [pagesRes, monitorsRes] = await Promise.all([
          api.get(`/status-pages?workspaceId=${workspace.id}`),
          api.get(`/monitors?workspaceId=${workspace.id}`)
        ]);
        setPages(pagesRes.data);
        setMonitors(monitorsRes.data);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load status pages');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;

    try {
      if (editingId) {
        const res = await api.put(`/status-pages/${editingId}`, formData);
        setPages(pages.map(p => p.id === editingId ? res.data : p));
        toast.success('Status page updated');
      } else {
        const res = await api.post('/status-pages', { ...formData, workspaceId: workspace.id });
        setPages([...pages, res.data]);
        toast.success('Status page created');
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save status page');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this status page?')) return;
    try {
      await api.delete(`/status-pages/${id}`);
      setPages(pages.filter(p => p.id !== id));
      toast.success('Status page deleted');
    } catch (err) {
      toast.error('Failed to delete status page');
    }
  };

  const openEditModal = (page: any) => {
    setEditingId(page.id);
    setFormData({
      title: page.title,
      description: page.description || '',
      slug: page.slug,
      themeColor: page.themeColor || '#f97316',
      monitorIds: page.monitors.map((m: any) => m.id)
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      title: '',
      description: '',
      slug: Math.random().toString(36).substring(7),
      themeColor: '#f97316',
      monitorIds: []
    });
    setShowModal(true);
  };

  const toggleMonitor = (id: string) => {
    setFormData(prev => ({
      ...prev,
      monitorIds: prev.monitorIds.includes(id) 
        ? prev.monitorIds.filter(m => m !== id)
        : [...prev.monitorIds, id]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-orange-500 font-bold text-xs uppercase tracking-[0.2em] mb-3"
          >
            <Globe className="w-4 h-4" />
            {t('status_pages.public_access')}
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl font-bold tracking-tight text-white mb-2 font-display"
          >
            {t('status_pages.title')}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-500 text-lg"
          >
            {t('status_pages.desc')}
          </motion.p>
        </div>
        
        <motion.button 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={openCreateModal}
          className="bg-white text-zinc-950 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-white/5 flex items-center justify-center gap-3 transition-all"
        >
          <Plus className="w-5 h-5" />
          {t('status_pages.new')}
        </motion.button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pages.map((page) => (
          <motion.div 
            key={page.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass border border-white/5 p-8 rounded-[2.5rem] card-gradient relative group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] -z-10 opacity-20 transition-opacity group-hover:opacity-40" style={{ backgroundColor: page.themeColor }} />
            
            <h3 className="text-2xl font-black text-white font-display tracking-tight mb-2">{page.title}</h3>
            <p className="text-zinc-400 text-sm mb-6 line-clamp-2 min-h-[40px]">{page.description}</p>
            
            <div className="flex items-center gap-2 mb-8 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
              <LinkIcon className="w-4 h-4 text-zinc-500" />
              <a href={`/status/${page.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-zinc-300 hover:text-white transition-colors truncate">
                /status/{page.slug}
              </a>
            </div>

            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-500">{t('status_pages.monitors_count').replace('{count}', page.monitors.length)}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditModal(page)} className="p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors">
                  <Settings className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(page.id)} className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {pages.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-900 rounded-[2.5rem]">
            <Globe className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
            <h3 className="text-xl font-bold text-white mb-2">{t('status_pages.no_pages')}</h3>
            <p className="text-zinc-500">{t('status_pages.no_pages_desc')}</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-3xl font-bold mb-8 font-display">{editingId ? t('status_pages.edit') : t('status_pages.new')}</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">{t('status_pages.page_title')}</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. MyCompany Status"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">{t('status_pages.url_slug')}</label>
                    <div className="flex items-center">
                      <span className="bg-zinc-950 border border-zinc-800 border-r-0 text-zinc-500 px-4 py-4 rounded-l-2xl text-sm font-mono">/status/</span>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-r-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm font-mono"
                        value={formData.slug}
                        onChange={e => setFormData({...formData, slug: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">{t('status_pages.description')}</label>
                  <textarea 
                    placeholder="All systems operational."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-colors text-sm min-h-[100px]"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">{t('status_pages.theme_color')}</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="color" 
                      className="w-14 h-14 rounded-xl cursor-pointer bg-transparent border-0 p-0"
                      value={formData.themeColor}
                      onChange={e => setFormData({...formData, themeColor: e.target.value})}
                    />
                    <span className="text-zinc-500 font-mono text-sm">{formData.themeColor}</span>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-zinc-800">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">{t('status_pages.included_monitors')}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-2">
                    {monitors.map(monitor => (
                      <div 
                        key={monitor.id}
                        onClick={() => toggleMonitor(monitor.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-colors flex items-center gap-3 ${
                          formData.monitorIds.includes(monitor.id) 
                            ? 'bg-orange-500/10 border-orange-500/50 text-orange-500' 
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                          formData.monitorIds.includes(monitor.id)
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'border-zinc-700'
                        }`}>
                          {formData.monitorIds.includes(monitor.id) && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                        <span className="font-bold text-sm truncate">{monitor.name}</span>
                      </div>
                    ))}
                    {monitors.length === 0 && (
                      <div className="col-span-2 text-center py-8 text-zinc-500 italic">{t('status_pages.no_monitors')}</div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold border border-zinc-800 hover:bg-zinc-800 transition-colors text-sm text-white"
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-white text-zinc-950 px-6 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-white/5 text-sm"
                  >
                    {editingId ? t('status_pages.save_changes') : t('status_pages.create')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
