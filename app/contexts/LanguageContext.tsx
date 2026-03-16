'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import translations from '@/lib/translations.json';

type Language = 'default' | 'en' | 'ha' | 'ig' | 'yo';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    // Load language from localStorage or browser preference
    const saved = localStorage.getItem('language') as Language;
    if (saved && ['default', 'en', 'ha', 'ig', 'yo'].includes(saved)) {
      setLanguageState(saved);
    } else {
      // Default to 'default' to show original content language
      setLanguageState('default');
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    const langTranslations = translations[language] || translations.en;
    return langTranslations[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

