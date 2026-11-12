import React from 'react';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

/**
 * Giris yapmamis ziyaretci icin ust bar: logo, dil secici ve giris baglantisi.
 * Onceden ana sayfada hicbiri yoktu; cikis yapmis kullanici dili
 * degistiremiyor, giris sayfasini yalnizca "Basla" dugmesinden bulabiliyordu.
 */
export default function PublicHeader() {
  const { t, language, setLanguage } = useTranslation();
  return (
    <header className="absolute top-0 left-0 right-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 text-white font-bold text-xl group">
          <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-display tracking-tight">Eyeon<span className="text-orange-500">.site</span></span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
            {(['tr', 'en'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  language === lang ? 'bg-orange-500/20 text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
          <Link to="/auth" className="bg-white text-zinc-950 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105">
            {t('auth.sign_in')}
          </Link>
        </div>
      </div>
    </header>
  );
}
