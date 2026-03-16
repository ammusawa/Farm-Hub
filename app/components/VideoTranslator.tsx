'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';

interface VideoTranslatorProps {
  contentId: number;
}

export default function VideoTranslator({ contentId }: VideoTranslatorProps) {
  const { language: userLanguage } = useLanguage();
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [showTranslator, setShowTranslator] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  useEffect(() => {
    const checkSubtitles = async () => {
      try {
        // Get available subtitle languages
        const languagesRes = await fetch(`/api/video/transcript/${contentId}/languages`);
        if (languagesRes.ok) {
          const languagesData = await languagesRes.json();
          const available = languagesData.languages || [];
          setAvailableLanguages(available);

          // Check if user's preferred language has subtitles
          const hasUserLanguage = available.includes(userLanguage);
          
          // If subtitles exist but not in user's language, show translator
          if (available.length > 0 && !hasUserLanguage) {
            setShowTranslator(true);
          } else {
            setShowTranslator(false);
          }
        } else {
          // No subtitles at all
          setShowTranslator(false);
        }
      } catch (error) {
        console.error('Failed to check subtitles:', error);
        setShowTranslator(false);
      }
    };

    if (contentId) {
      checkSubtitles();
    }
  }, [contentId, userLanguage]);

  const handleTranslate = async () => {
    if (availableLanguages.length === 0) {
      setTranslationError('No transcript available to translate');
      return;
    }

    setTranslating(true);
    setTranslationError(null);

    try {
      // Use the first available language as source (usually the original)
      const sourceLanguage = availableLanguages[0];

      const res = await fetch('/api/video/translate-on-demand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId,
          sourceLanguage,
          targetLanguage: userLanguage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Save the translated subtitles to database for future use
        await fetch('/api/video/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            contentId,
            language: userLanguage,
            transcript: data.transcript,
            subtitles: data.subtitles,
          }),
        });

        // Reload the page or trigger subtitle reload
        // The VideoPlayer will automatically pick up the new subtitles
        window.location.reload();
      } else {
        const errorData = await res.json();
        setTranslationError(errorData.error || 'Translation failed');
      }
    } catch (error) {
      console.error('Translation error:', error);
      setTranslationError('Failed to translate. Please try again.');
    } finally {
      setTranslating(false);
    }
  };

  if (!showTranslator) return null;

  const langNames: Record<string, string> = {
    en: 'English',
    ha: 'Hausa',
    ig: 'Igbo',
    yo: 'Yoruba',
  };

  const sourceLangName = availableLanguages[0] ? langNames[availableLanguages[0]] || availableLanguages[0].toUpperCase() : 'Unknown';
  const targetLangName = langNames[userLanguage] || userLanguage.toUpperCase();

  return (
    <div className="absolute top-4 right-4 z-20">
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 max-w-xs">
        <div className="flex items-start gap-2 mb-2">
          <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-white text-sm font-medium mb-1">
              No subtitles in {targetLangName}
            </p>
            <p className="text-gray-300 text-xs mb-2">
              Translate from {sourceLangName} to {targetLangName}?
            </p>
            {translationError && (
              <p className="text-red-400 text-xs mb-2">{translationError}</p>
            )}
            <button
              onClick={handleTranslate}
              disabled={translating}
              className="w-full px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {translating ? (
                <>
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Translating...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.494 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clipRule="evenodd" />
                  </svg>
                  Translate to {targetLangName}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

