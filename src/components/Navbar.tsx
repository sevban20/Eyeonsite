import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Activity, LogOut, Settings, LayoutDashboard, Bell, Shield, Globe } from 'lucide-react';
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

  const handleSignOut = async () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { name: t('nav.dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { name: t('nav.alerts'), path: '/alerts', icon: Bell },
    { name: t('nav.status_pages') || 'Status Pages', path: '/status-pages', icon: Globe },
    { name: t('nav.settings'), path: '/settings', icon: Settings },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-20 glass z-[100] px-8 flex items-center justify-between border-b border-zinc-800/50">
      <div className="flex items-center gap-12">
        <Link to="/dashboard" className="flex items-center gap-2.5 text-white font-bold text-xl group">
          <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-display tracking-tight">Uptime<span className="text-orange-500">SaaS</span></span>
        </Link>
        
        <div className="hidden md:flex items-center gap-1 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path}
                to={item.path} 
                className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
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

      <div className="flex items-center gap-6">
        {/* Language Switcher */}
        <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
          <Globe className="w-3.5 h-3.5 text-zinc-500 mx-1.5" />
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
            <span className="text-xs font-bold text-zinc-100">{user.displayName || user.email?.split('@')[0]}</span>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-orange-500" />
              <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{workspace?.plan || 'Free'} {t('nav.plan')}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-sm">
            {user.email?.[0].toUpperCase()}
          </div>
        </div>
        
        <button 
          onClick={handleSignOut}
          className="p-3 hover:bg-red-500/10 rounded-2xl transition-all text-zinc-500 hover:text-red-500 group"
          title={t('nav.sign_out')}
        >
          <LogOut className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </nav>
  );
}
