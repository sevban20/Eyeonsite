import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Activity, LogOut, Settings, LayoutDashboard, Bell, Shield, Globe, Eye, Menu, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { useTranslation } from '../lib/i18n';

interface NavbarProps {
  user: any;
  workspace: any;
}

export default function Navbar({ user, workspace }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  // Dar ekranda (768 px alti) linkler gizli; onceden yerine hicbir menu yoktu.
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleSignOut = async () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { name: t('nav.dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { name: t('nav.alerts'), path: '/alerts', icon: Bell },
    { name: t('nav.status_pages'), path: '/status-pages', icon: Globe },
    { name: t('nav.settings'), path: '/settings', icon: Settings },
  ];

  if (user?.role === 'SYSTEM_ADMIN') {
    navItems.push({ name: t('nav.admin'), path: '/admin', icon: Shield });
  }

  return (
    <nav className="fixed top-0 left-0 right-0 h-20 glass z-[100] px-4 sm:px-8 flex items-center justify-between border-b border-zinc-800/50">
      <div className="flex items-center gap-6 lg:gap-12">
        <Link to="/dashboard" className="flex items-center gap-2.5 text-white font-bold text-xl group">
          <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-display tracking-tight flex items-center gap-0">
            Eye
            <span className="relative flex items-center justify-center mx-0.5">
              <Eye className="w-5 h-5 text-orange-500 stroke-[3]" />
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }} 
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_white]" 
              />
            </span>
            n<span className="text-orange-500">.site</span>
          </span>
        </Link>
        
        <div className="hidden md:flex items-center gap-1 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname.startsWith('/monitor/'));
            return (
              <Link 
                key={item.path}
                to={item.path} 
                className={`relative px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                  isActive 
                    ? 'bg-white/5 text-white' 
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02]'
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? 'text-orange-500' : ''}`} />
                {item.name}
                {isActive && (
                  <motion.div 
                    layoutId="nav-active"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-500"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-6">
        {/* Language Switcher */}
        <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
          <Globe className="hidden sm:block w-3.5 h-3.5 text-zinc-500 mx-1.5" />
          <button 
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              language === 'en' ? 'bg-orange-500/20 text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            EN
          </button>
          <button 
            onClick={() => setLanguage('tr')}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              language === 'tr' ? 'bg-orange-500/20 text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            TR
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-4 pr-4 border-r border-zinc-800">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-zinc-100">{user.name?.trim() || user.email?.split('@')[0]}</span>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-orange-500" />
              <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{user.plan || 'FREE'} {t('nav.plan')}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-sm">
            {user.email?.[0].toUpperCase()}
          </div>
        </div>
        
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="md:hidden p-3 hover:bg-white/5 rounded-2xl text-zinc-400 hover:text-white transition-colors"
          aria-label={t('nav.menu')}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <button 
          onClick={handleSignOut}
          className="p-3 hover:bg-red-500/10 rounded-2xl transition-all text-zinc-500 hover:text-red-500 group"
          title={t('nav.sign_out')}
        >
          <LogOut className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden absolute top-20 left-0 right-0 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3 flex flex-col gap-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium ${isActive ? 'bg-white/5 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? 'text-orange-500' : ''}`} />
                {item.name}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
