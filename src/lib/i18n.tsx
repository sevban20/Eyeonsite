import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from '../locales/en.json';
import tr from '../locales/tr.json';
import { translateApiError } from './apiError';

export type Language = 'en' | 'tr';

const translations: Record<Language, any> = { en, tr };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  /** Sunucu hatasini arayuz diline cevirir; taninmazsa fallbackKey kullanilir. */
  apiError: (err: any, fallbackKey: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
  apiError: (_err: any, fallbackKey: string) => fallbackKey,
});

function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((acc, part) => acc?.[part], obj) ?? path;
}

function detectLanguage(): Language {
  const stored = localStorage.getItem('uptimesaas-lang');
  if (stored === 'en' || stored === 'tr') return stored;
  const browserLang = navigator.language?.slice(0, 2);
  if (browserLang === 'tr') return 'tr';
  return 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('uptimesaas-lang', lang);
  }, []);

  const t = useCallback((key: string): string => {
    return getNestedValue(translations[language], key);
  }, [language]);

  const apiError = useCallback((err: any, fallbackKey: string) => translateApiError(err, t, language, fallbackKey), [t, language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, apiError }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
