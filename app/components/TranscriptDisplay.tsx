'use client';

import { useState, useEffect, useRef } from 'react';

interface TranscriptDisplayProps {
  contentId: number;
  selectedLanguage: string;
  onLanguageChange?: (language: string) => void;
  availableLanguages?: string[];
  originalLanguage?: string;
}

export default function TranscriptDisplay({ 
  contentId, 
  selectedLanguage, 
  onLanguageChange,
  availableLanguages: propAvailableLanguages,
  originalLanguage: propOriginalLanguage
}: TranscriptDisplayProps) {
  const [transcript, setTranscript] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>(propAvailableLanguages || []);
  const [originalLanguage, setOriginalLanguage] = useState<string | null>(propOriginalLanguage || null);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const previousLanguageRef = useRef<string | null>(null);

  // Debug: Log when transcript changes (must be before conditional returns)
  useEffect(() => {
    if (transcript) {
      console.log('[TranscriptDisplay] Transcript state updated, length:', transcript.length, 'language:', selectedLanguage);
    }
  }, [transcript, selectedLanguage]);

  // Log when selectedLanguage prop changes
  useEffect(() => {
    if (previousLanguageRef.current !== selectedLanguage) {
      console.log('[TranscriptDisplay] Selected language changed from', previousLanguageRef.current, 'to', selectedLanguage);
      previousLanguageRef.current = selectedLanguage;
    }
  }, [selectedLanguage]);

  // Update local state when props change
  useEffect(() => {
    if (propAvailableLanguages && propAvailableLanguages.length > 0) {
      setAvailableLanguages(propAvailableLanguages);
    }
    if (propOriginalLanguage) {
      setOriginalLanguage(propOriginalLanguage);
    }
  }, [propAvailableLanguages, propOriginalLanguage]);

  useEffect(() => {
    // Immediately clear transcript when language changes
    setTranscript('');
    setError(null);
    
    const loadTranscript = async () => {
      if (!contentId || !selectedLanguage) {
        setLoading(false);
        return;
      }

      console.log('[TranscriptDisplay] ===== Loading transcript =====');
      console.log('[TranscriptDisplay] Content ID:', contentId);
      console.log('[TranscriptDisplay] Selected Language:', selectedLanguage);
      console.log('[TranscriptDisplay] Available Languages (props):', propAvailableLanguages);
      console.log('[TranscriptDisplay] Original Language (props):', propOriginalLanguage);
      console.log('[TranscriptDisplay] Available Languages (state):', availableLanguages);
      console.log('[TranscriptDisplay] Original Language (state):', originalLanguage);

      setLoading(true);

      try {
        // First, get available languages and original language
        let availableLangs: string[] = propAvailableLanguages || availableLanguages || [];
        let originalLang: string | null = propOriginalLanguage || originalLanguage;
        
        // Only fetch if not provided as props and not in state
        if (availableLangs.length === 0 || !originalLang) {
          console.log('[TranscriptDisplay] Fetching available languages from API...');
          const langRes = await fetch(`/api/video/transcript/${contentId}/languages`);
          if (langRes.ok) {
            const langData = await langRes.json();
            availableLangs = langData.languages || [];
            originalLang = langData.originalLanguage || (availableLangs.length > 0 ? availableLangs[0] : null);
            console.log('[TranscriptDisplay] Available languages from API:', availableLangs, 'Original:', originalLang);
          }
        }
        
        // Update state if we got new data
        if (availableLangs.length > 0) {
          setAvailableLanguages(availableLangs);
        }
        if (originalLang) {
          setOriginalLanguage(originalLang);
        }
        
        if (availableLangs.length === 0) {
          setTranscript('');
          setError('No transcript available');
          setLoading(false);
          return;
        }

        // If selected language is the original, use it directly
        if (selectedLanguage === originalLang) {
          console.log('[TranscriptDisplay] Fetching original transcript for:', selectedLanguage);
        const res = await fetch(`/api/video/transcript/${contentId}?language=${selectedLanguage}`);
        if (res.ok) {
          const data = await res.json();
          if (data.transcript) {
              console.log('[TranscriptDisplay] Found original transcript, length:', data.transcript.length);
            setTranscript(data.transcript);
            setLoading(false);
              setError(null);
            return;
          }
          }
        }

        // If transcript exists in selected language, check if it's different from original
        // If it's the same language as original, we already handled it above
        if (availableLangs.includes(selectedLanguage) && selectedLanguage !== originalLang) {
          console.log('[TranscriptDisplay] Checking existing transcript for:', selectedLanguage);
          const res = await fetch(`/api/video/transcript/${contentId}?language=${selectedLanguage}`);
          if (res.ok) {
            const data = await res.json();
            if (data.transcript && data.transcript.trim() !== '') {
              // Compare with original to see if it's actually translated
              const origRes = await fetch(`/api/video/transcript/${contentId}?language=${originalLang}`);
              if (origRes.ok) {
                const origData = await origRes.json();
                if (origData.transcript && data.transcript !== origData.transcript) {
                  // Transcripts are different, so this is a real translation
                  console.log('[TranscriptDisplay] Found translated transcript, length:', data.transcript.length);
                  setTranscript(data.transcript);
                  setLoading(false);
                  setError(null);
                  return;
                } else {
                  // Transcripts are the same, so it's not actually translated - translate on-demand
                  console.log('[TranscriptDisplay] Existing transcript is same as original, translating on-demand');
                }
              } else {
                // Can't compare, but transcript exists - use it
                console.log('[TranscriptDisplay] Using existing transcript (could not compare)');
                setTranscript(data.transcript);
                setLoading(false);
                setError(null);
                return;
              }
            }
          }
        }

        // Transcript not found in selected language or is same as original - try on-demand translation from original
        if (originalLang && originalLang !== selectedLanguage) {
          console.log('[TranscriptDisplay] Translating from', originalLang, 'to', selectedLanguage);
          try {
            // Force fresh translation if we detected cached version is same as original
            const trRes = await fetch('/api/video/translate-on-demand', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contentId,
                sourceLanguage: originalLang,
                targetLanguage: selectedLanguage,
                force: true, // Force fresh translation to avoid bad cache
              }),
            });
            
            if (trRes.ok) {
              const trData = await trRes.json();
              console.log('[TranscriptDisplay] Translation response:', {
                success: trData.success,
                hasTranscript: !!trData.transcript,
                transcriptLength: trData.transcript?.length || 0,
                cached: trData.cached,
                language: trData.language
              });
              
              if (trData.transcript && trData.transcript.trim() !== '') {
                // Verify the translation is actually different from original
                // Get original transcript for comparison
                const origCheckRes = await fetch(`/api/video/transcript/${contentId}?language=${originalLang}`);
                if (origCheckRes.ok) {
                  const origCheckData = await origCheckRes.json();
                  if (origCheckData.transcript && trData.transcript.trim() === origCheckData.transcript.trim()) {
                    // Translation is same as original - this means translation failed or returned original
                    console.warn('[TranscriptDisplay] Translation result is same as original - translation may have failed');
                    setError(`Translation returned the original text. The translation service may not be working correctly. Please check if translator_service.py is running and translating properly.`);
                    setLoading(false);
                    return;
                  }
                }
                
                console.log('[TranscriptDisplay] Translation successful, length:', trData.transcript.length);
                console.log('[TranscriptDisplay] Translated text preview:', trData.transcript.substring(0, 100));
                setTranscript(trData.transcript);
                setLoading(false);
                setError(null);
                return;
              } else {
                console.warn('[TranscriptDisplay] Translation returned empty transcript');
                setError(`Translation returned empty result. The translation service may not be running. Please ensure translator_service.py is running on port 5000.`);
                setLoading(false);
              }
            } else {
              const errorData = await trRes.json().catch(() => ({ error: 'Translation failed' }));
              console.error('[TranscriptDisplay] Translation API error:', errorData);
              const errorMsg = errorData.error || 'Translation failed';
              setError(`Translation failed: ${errorMsg}. ${errorMsg.includes('service') || errorMsg.includes('5000') ? 'Please ensure translator_service.py is running.' : ''}`);
              setLoading(false);
            }
          } catch (err: any) {
            console.error('[TranscriptDisplay] Translation request failed:', err);
            const errorMsg = err.message || 'Translation request failed';
            setError(`Translation failed: ${errorMsg}. Please check if the translation service is running.`);
            setLoading(false);
          }
        }
        
        // Fallback: show original transcript if translation failed
        if (originalLang) {
          console.log('[TranscriptDisplay] Falling back to original transcript:', originalLang);
          const sourceRes = await fetch(`/api/video/transcript/${contentId}?language=${originalLang}`);
          if (sourceRes.ok) {
            const sourceData = await sourceRes.json();
            if (sourceData.transcript) {
              setTranscript(sourceData.transcript);
              setError(`Translation to ${selectedLanguage.toUpperCase()} is not available. Showing original transcript in ${originalLang.toUpperCase()}.`);
              setLoading(false);
              return;
            }
          }
        }
        
        setTranscript('');
        setError('No transcript available');
      } catch (err) {
        console.error('[TranscriptDisplay] Failed to load transcript:', err);
        setError('Failed to load transcript');
        setTranscript('');
      } finally {
        setLoading(false);
      }
    };

    loadTranscript();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId, selectedLanguage, propAvailableLanguages, propOriginalLanguage]);

  // Close language selector when clicking outside
  // MUST be before any conditional returns to follow Rules of Hooks
  useEffect(() => {
    if (!showLanguageSelector) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const selector = document.querySelector('[data-transcript-language-selector]');
      const button = document.querySelector('[data-transcript-language-button]');
      
      if (selector && button) {
        if (!selector.contains(target) && !button.contains(target)) {
          setShowLanguageSelector(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLanguageSelector]);

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-500">Loading transcript...</p>
      </div>
    );
  }

  if (!transcript && error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
        <p className="text-sm text-yellow-800">{error}</p>
      </div>
    );
  }

  if (!transcript) {
    return null;
  }

  const langNames: Record<string, string> = {
    en: 'English',
    ha: 'Hausa',
    ig: 'Igbo',
    yo: 'Yoruba',
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-700">Transcript</h4>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
              {error}
            </span>
          )}
          {/* Language Selector */}
          {availableLanguages.length > 1 && (
            <div className="relative">
              <button
                data-transcript-language-button
                onClick={() => setShowLanguageSelector(!showLanguageSelector)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
                title="Change transcript language"
              >
                <span className="uppercase text-xs">{selectedLanguage}</span>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {showLanguageSelector && (
                <div data-transcript-language-selector className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden z-10 min-w-[150px]">
                  {availableLanguages.map((lang) => {
                    const label =
                      originalLanguage && lang === originalLanguage
                        ? `Original (${langNames[lang] || lang.toUpperCase()})`
                        : langNames[lang] || lang.toUpperCase();
                    return (
                      <button
                        key={lang}
                        onClick={() => {
                          console.log('[TranscriptDisplay] Language changed to:', lang);
                          setShowLanguageSelector(false);
                          if (onLanguageChange) {
                            onLanguageChange(lang);
                          }
                        }}
                        className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                          selectedLanguage === lang ? 'bg-primary-100 text-primary-700 font-medium' : ''
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
        {transcript || <span className="text-gray-400">No transcript available</span>}
      </div>
    </div>
  );
}

