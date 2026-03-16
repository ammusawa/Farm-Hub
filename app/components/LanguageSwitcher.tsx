'use client';

import { useLanguage } from '@/app/contexts/LanguageContext';

const languages = [
  { code: 'default' as const, name: 'Default' },
  { code: 'en' as const, name: 'English' },
  { code: 'ha' as const, name: 'Hausa' },
  { code: 'ig' as const, name: 'Igbo' },
  { code: 'yo' as const, name: 'Yoruba' },
];

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as 'default' | 'en' | 'ha' | 'ig' | 'yo')}
      className="bg-primary-700 text-white px-3 py-2 rounded border-none outline-none"
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
}

