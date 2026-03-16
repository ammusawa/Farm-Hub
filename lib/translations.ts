import pool from './db';

export type Language = 'en' | 'ha' | 'ig' | 'yo';

let translationCache: Record<string, Record<Language, string>> = {};

export async function loadTranslations() {
  try {
    const [rows] = await pool.execute('SELECT `key`, en, ha, ig, yo FROM translations');
    const translations = rows as any[];
    
    translationCache = {};
    translations.forEach((row) => {
      translationCache[row.key] = {
        en: row.en || '',
        ha: row.ha || row.en || '',
        ig: row.ig || row.en || '',
        yo: row.yo || row.en || '',
      };
    });
  } catch (error) {
    console.error('Error loading translations:', error);
  }
}

export function getTranslation(key: string, lang: Language = 'en'): string {
  return translationCache[key]?.[lang] || translationCache[key]?.['en'] || key;
}

export function t(key: string, lang: Language = 'en'): string {
  return getTranslation(key, lang);
}

// Initialize translations on module load
if (typeof window === 'undefined') {
  loadTranslations();
}

