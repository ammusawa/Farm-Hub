'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/app/contexts/LanguageContext';

interface Subtitle {
  start: number;
  end: number;
  text: string;
}

interface VideoPlayerProps {
  src: string;
  title?: string;
  autoPlay?: boolean;
  showControls?: boolean;
  contentId?: number;
  onLanguageChange?: (language: string) => void;
  selectedTranscriptLanguage?: string | null; // External language selection from parent
}

export default function VideoPlayer({ src, title, autoPlay = false, showControls = true, contentId, onLanguageChange, selectedTranscriptLanguage }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasInitializedLanguage = useRef<string | null>(null); // Store contentId that was initialized
  const onLanguageChangeRef = useRef(onLanguageChange);
  
  // Keep ref updated with latest callback
  useEffect(() => {
    onLanguageChangeRef.current = onLanguageChange;
  }, [onLanguageChange]);
  
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [videoLanguage, setVideoLanguage] = useState<string>(language);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [originalSubtitles, setOriginalSubtitles] = useState<Subtitle[]>([]);
  const [originalLanguage, setOriginalLanguage] = useState<string>('');
  const [originalTranscriptText, setOriginalTranscriptText] = useState<string>('');
  const [translatedVideoSrc, setTranslatedVideoSrc] = useState<string | null>(null);
  const [translationStatus, setTranslationStatus] = useState<'not_started' | 'processing' | 'completed' | 'failed'>('not_started');
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const [subtitleLoading, setSubtitleLoading] = useState(false);

  // Load available languages for this video (only once per contentId)
  useEffect(() => {
    if (!contentId) return;

    // Only initialize if we haven't initialized for this contentId yet
    if (hasInitializedLanguage.current === contentId) return;

    const loadAvailableLanguages = async () => {
      try {
        const res = await fetch(`/api/video/transcript/${contentId}/languages`);
        if (res.ok) {
          const data = await res.json();
            if (data.languages && Array.isArray(data.languages)) {
              const langs = data.languages;
              setAvailableLanguages(langs);

              // Default to original uploaded transcript language (first uploaded)
              // This is the language the user uploaded the transcript in
              const originalLang = data.originalLanguage || (langs.length > 0 ? langs[0] : null);
                setOriginalLanguage(originalLang);
                
              // Use selectedTranscriptLanguage if provided, otherwise use original
              const initialLang = selectedTranscriptLanguage && langs.includes(selectedTranscriptLanguage) 
                ? selectedTranscriptLanguage 
                : originalLang;
              
              if (initialLang) {
                // Set to the determined initial language
                setVideoLanguage(initialLang);
                
                // Only notify parent on initial load (once per contentId) if we're using original
                // If selectedTranscriptLanguage was provided, parent already knows
                if (hasInitializedLanguage.current !== contentId) {
                  if (!selectedTranscriptLanguage || initialLang !== selectedTranscriptLanguage) {
                    console.log('[VideoPlayer] Initial language set to:', initialLang);
                  if (onLanguageChangeRef.current) {
                      onLanguageChangeRef.current(initialLang);
                    }
                  }
                  hasInitializedLanguage.current = contentId;
                }
              } else if (langs.length > 0) {
                // Fallback to first available if no original specified
                setVideoLanguage(langs[0]);
                if (hasInitializedLanguage.current !== contentId) {
                  console.log('[VideoPlayer] Initial language set to (fallback):', langs[0]);
                  if (onLanguageChangeRef.current) {
                    onLanguageChangeRef.current(langs[0]);
                  }
                  hasInitializedLanguage.current = contentId;
                }
              }
            }
        }
      } catch (error) {
        console.error('Failed to load available languages:', error);
        // Still notify parent of default language on initial load only
        if (hasInitializedLanguage.current !== contentId) {
          if (onLanguageChangeRef.current) {
            onLanguageChangeRef.current(language);
          }
          hasInitializedLanguage.current = contentId;
        }
      }
    };

    loadAvailableLanguages();
  }, [contentId, language, selectedTranscriptLanguage]); // Include selectedTranscriptLanguage to respect it on initial load

  // Update videoLanguage when selectedTranscriptLanguage changes from parent
  useEffect(() => {
    if (selectedTranscriptLanguage && selectedTranscriptLanguage !== videoLanguage) {
      console.log('[VideoPlayer] Updating videoLanguage from selectedTranscriptLanguage:', selectedTranscriptLanguage);
      // Clear current subtitle immediately when language changes
      setCurrentSubtitle('');
      setSubtitles([]);
      setVideoLanguage(selectedTranscriptLanguage);
    }
  }, [selectedTranscriptLanguage, videoLanguage]);

  // Load subtitles for the selected video language
  useEffect(() => {
    if (!contentId || !videoLanguage) {
      console.log('[VideoPlayer] Cannot load subtitles - missing contentId or videoLanguage');
      return;
    }

    console.log('[VideoPlayer] ===== Loading subtitles =====');
    console.log('[VideoPlayer] Content ID:', contentId);
    console.log('[VideoPlayer] Requested language:', videoLanguage);
    console.log('[VideoPlayer] Original language:', originalLanguage);
    console.log('[VideoPlayer] Original subtitles stored:', originalSubtitles.length);
    console.log('[VideoPlayer] Original transcript stored:', !!originalTranscriptText);

    const loadSubtitles = async () => {
      // Immediately clear all subtitle-related state when language changes
      setCurrentSubtitle('');
      setSubtitles([]);
      setTranscriptText('');
      setSubtitleLoading(true);
      setSubtitleError(null);
      
      try {
        
        // If we don't have original subtitles yet and this is not the original language, load original first
        if (originalSubtitles.length === 0 && originalLanguage && videoLanguage !== originalLanguage) {
          console.log('[VideoPlayer] Step 1: Loading original subtitles first...');
          try {
            const origRes = await fetch(`/api/video/transcript/${contentId}?language=${originalLanguage}`);
            if (origRes.ok) {
              const origData = await origRes.json();
              console.log('[VideoPlayer] Original transcript response:', {
                hasTranscript: !!origData.transcript,
                hasSubtitles: !!origData.subtitles,
                subtitlesType: typeof origData.subtitles,
                subtitlesIsArray: Array.isArray(origData.subtitles),
                subtitlesLength: Array.isArray(origData.subtitles) ? origData.subtitles.length : 'N/A'
              });
              
              if (origData.subtitles && Array.isArray(origData.subtitles) && origData.subtitles.length > 0) {
                console.log('[VideoPlayer] ✓ Stored original subtitles:', origData.subtitles.length, 'entries');
                setOriginalSubtitles(origData.subtitles);
                if (!originalTranscriptText && origData.transcript) {
                  setOriginalTranscriptText(origData.transcript);
                }
              } else {
                console.warn('[VideoPlayer] ⚠ Original subtitles not found or empty');
                setSubtitleError('Original subtitles not available for translation');
              }
            } else {
              console.error('[VideoPlayer] ✗ Failed to load original transcript:', origRes.status, origRes.statusText);
              setSubtitleError(`Failed to load original transcript: ${origRes.status}`);
            }
          } catch (error: any) {
            console.error('[VideoPlayer] ✗ Error loading original subtitles:', error);
            setSubtitleError(`Error loading original: ${error.message}`);
          }
        }
        
        console.log('[VideoPlayer] Step 2: Fetching transcript for language:', videoLanguage);
        const res = await fetch(`/api/video/transcript/${contentId}?language=${videoLanguage}`);
        if (res.ok) {
          const data = await res.json();
          console.log('[VideoPlayer] Transcript API response:', {
            hasTranscript: !!data.transcript,
            hasSubtitles: !!data.subtitles,
            subtitlesType: typeof data.subtitles,
            subtitlesIsArray: Array.isArray(data.subtitles),
            subtitlesLength: Array.isArray(data.subtitles) ? data.subtitles.length : 'N/A',
            language: data.language
          });
          
          // Load both transcript text and subtitles
          if (data.transcript) {
            setTranscriptText(data.transcript);
            // Store original transcript only if this is the original language
            if (videoLanguage === originalLanguage && !originalTranscriptText) {
              setOriginalTranscriptText(data.transcript);
            }
          }
          
          if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
            // Verify these subtitles are actually translated (not just original with wrong language code)
            if (videoLanguage !== originalLanguage && originalLanguage) {
              // Need to compare with original to verify it's actually translated
              if (originalSubtitles.length === 0) {
                // Load original subtitles for comparison
                try {
                  const origRes = await fetch(`/api/video/transcript/${contentId}?language=${originalLanguage}`);
                  if (origRes.ok) {
                    const origData = await origRes.json();
                    if (origData.subtitles && Array.isArray(origData.subtitles)) {
                      setOriginalSubtitles(origData.subtitles);
                      // Compare first subtitle text to see if they're the same
                      if (origData.subtitles.length > 0 && data.subtitles.length > 0) {
                        const origText = origData.subtitles[0]?.text || '';
                        const currentText = data.subtitles[0]?.text || '';
                        if (origText === currentText || origText.trim() === currentText.trim()) {
                          // Subtitles are the same as original - not actually translated
                          console.warn('[VideoPlayer] ⚠ Subtitles for', videoLanguage, 'are same as original - forcing fresh translation');
                          // Fall through to translation logic below
                        } else {
                          // Subtitles are different - they're actually translated
                          console.log('[VideoPlayer] ✓ Found valid translated subtitles:', data.subtitles.length, 'entries for language:', videoLanguage);
                          setSubtitles(data.subtitles);
                          setSubtitleError(null);
                          setSubtitleLoading(false);
                          return;
                        }
                      } else {
                        // Can't compare, but subtitles exist - use them
                        console.log('[VideoPlayer] ✓ Found subtitles in database:', data.subtitles.length, 'entries for language:', videoLanguage);
                        setSubtitles(data.subtitles);
                        setSubtitleError(null);
                        setSubtitleLoading(false);
                        return;
                      }
                    }
                  }
                } catch (error) {
                  console.error('[VideoPlayer] Error comparing subtitles:', error);
                  // If comparison fails, use the subtitles we have
                  console.log('[VideoPlayer] ✓ Found subtitles in database:', data.subtitles.length, 'entries for language:', videoLanguage);
                  setSubtitles(data.subtitles);
                  setSubtitleError(null);
                  setSubtitleLoading(false);
                  return;
                }
              } else {
                // We already have original subtitles - compare directly
                if (originalSubtitles.length > 0 && data.subtitles.length > 0) {
                  const origText = originalSubtitles[0]?.text || '';
                  const currentText = data.subtitles[0]?.text || '';
                  if (origText === currentText || origText.trim() === currentText.trim()) {
                    // Subtitles are the same as original - not actually translated
                    console.warn('[VideoPlayer] ⚠ Subtitles for', videoLanguage, 'are same as original - forcing fresh translation');
                    // Fall through to translation logic below
                  } else {
                    // Subtitles are different - they're actually translated
                    console.log('[VideoPlayer] ✓ Found valid translated subtitles:', data.subtitles.length, 'entries for language:', videoLanguage);
                    setSubtitles(data.subtitles);
                    setSubtitleError(null);
                    setSubtitleLoading(false);
                    return;
                  }
                } else {
                  // Can't compare, but subtitles exist - use them
                  console.log('[VideoPlayer] ✓ Found subtitles in database:', data.subtitles.length, 'entries for language:', videoLanguage);
                  setSubtitles(data.subtitles);
                  setSubtitleError(null);
                  setSubtitleLoading(false);
                  return;
                }
              }
            } else {
              // This is the original language - use subtitles directly
            console.log('[VideoPlayer] ✓ Found subtitles in database:', data.subtitles.length, 'entries for language:', videoLanguage);
            setSubtitles(data.subtitles);
            setSubtitleError(null);
            setSubtitleLoading(false);
            // Store original subtitles only if this is the original language
            if (videoLanguage === originalLanguage && originalSubtitles.length === 0) {
              setOriginalSubtitles(data.subtitles);
            }
              return;
            }
          }
          
          // If we reach here, subtitles either don't exist or are same as original - need to translate
          if (!data.subtitles || !Array.isArray(data.subtitles) || data.subtitles.length === 0) {
            // No subtitles found for this language - try to translate from original
            console.log('[VideoPlayer] Step 3: No subtitles found for language:', videoLanguage, '- attempting translation');
          } else {
            // Subtitles exist but are same as original - need fresh translation
            console.log('[VideoPlayer] Step 3: Subtitles exist but are same as original - forcing fresh translation for:', videoLanguage);
          }
          
          // Translation logic (for both cases: no subtitles or same as original)
          {
            
            // If we have original subtitles and this is a different language, translate them
            if (
              originalSubtitles.length > 0 &&
              originalLanguage &&
              videoLanguage !== originalLanguage
            ) {
              console.log('[VideoPlayer] Step 4: Translating subtitles from', originalLanguage, 'to', videoLanguage);
              console.log('[VideoPlayer] Original subtitles count:', originalSubtitles.length);
              console.log('[VideoPlayer] First subtitle sample:', originalSubtitles[0]);
              
              try {
                const translatePayload = {
                  contentId,
                  sourceLanguage: originalLanguage,
                  targetLanguage: videoLanguage,
                  force: true, // Force fresh translation to avoid bad cache
                };
                console.log('[VideoPlayer] Translation request payload:', translatePayload);
                
                const tr = await fetch('/api/video/translate-on-demand', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(translatePayload),
                });
                
                console.log('[VideoPlayer] Translation response status:', tr.status, tr.statusText);
                
                if (tr.ok) {
                  const trData = await tr.json();
                  console.log('[VideoPlayer] Translation response data:', {
                    success: trData.success,
                    hasTranscript: !!trData.transcript,
                    hasSubtitles: !!trData.subtitles,
                    subtitlesType: typeof trData.subtitles,
                    subtitlesIsArray: Array.isArray(trData.subtitles),
                    subtitlesLength: Array.isArray(trData.subtitles) ? trData.subtitles.length : 'N/A',
                    language: trData.language
                  });
                  
                  if (trData.subtitles && Array.isArray(trData.subtitles) && trData.subtitles.length > 0) {
                    console.log('[VideoPlayer] ✓ Successfully translated subtitles:', trData.subtitles.length, 'entries');
                    console.log('[VideoPlayer] First translated subtitle:', trData.subtitles[0]);
                    // Update both transcript and subtitles
                    if (trData.transcript) {
                      setTranscriptText(trData.transcript);
                    }
                    setSubtitles(trData.subtitles);
                    setSubtitleError(null);
                    setSubtitleLoading(false);
                    return;
                  } else {
                    console.warn('[VideoPlayer] ⚠ Translation returned no subtitles');
                    setSubtitleError('Translation completed but no subtitles returned');
                  }
                } else {
                  const errorData = await tr.json().catch(() => ({ error: 'Unknown error' }));
                  console.error('[VideoPlayer] ✗ Translation failed:', tr.status, errorData);
                  setSubtitleError(`Translation failed: ${errorData.error || tr.statusText}`);
                }
              } catch (error: any) {
                console.error('[VideoPlayer] ✗ Translation error:', error);
                setSubtitleError(`Translation error: ${error.message || 'Unknown error'}`);
              }
              
              // If translation fails, don't show original subtitles - keep empty to show error
              // Only show original if user explicitly requests original language
              if (videoLanguage === originalLanguage && originalSubtitles.length > 0) {
                console.log('[VideoPlayer] Using original subtitles for original language');
                setSubtitles(originalSubtitles);
                setSubtitleError(null);
                setSubtitleLoading(false);
              } else {
                console.log('[VideoPlayer] Translation failed - keeping subtitles empty');
                setSubtitles([]);
                setSubtitleLoading(false);
                // Don't show original subtitles when translation fails - user wants translated version
              }
            } else {
              const reason = !originalSubtitles.length ? 'no original subtitles stored' : 
                           !originalLanguage ? 'original language not set' : 
                           videoLanguage === originalLanguage ? 'same as original language' : 'unknown';
              console.warn('[VideoPlayer] ⚠ Cannot translate subtitles:', reason);
              setSubtitleError(`Cannot translate: ${reason}`);
              
              if (data.transcript && !data.subtitles) {
                // If we have transcript but no subtitles and no original to translate from, clear subtitles
                console.log('[VideoPlayer] No subtitles available and no original to translate from');
                setSubtitles([]);
              } else {
                // Fallback: if requested language not available, try on-demand translation from original transcript
                if (
                  originalTranscriptText &&
                  originalLanguage &&
                  videoLanguage !== originalLanguage
                ) {
                  try {
                    const tr = await fetch('/api/video/translate-on-demand', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        contentId,
                        sourceLanguage: originalLanguage,
                        targetLanguage: videoLanguage,
                        force: true, // Force fresh translation
                      }),
                    });
                    if (tr.ok) {
                      const trData = await tr.json();
                      if (trData.transcript) {
                        setTranscriptText(trData.transcript);
                      }
                      if (trData.subtitles && Array.isArray(trData.subtitles) && trData.subtitles.length > 0) {
                        console.log('[VideoPlayer] Translated subtitles from transcript:', trData.subtitles.length, 'entries');
                        setSubtitles(trData.subtitles);
                        return;
                      }
                    }
                  } catch (error) {
                    console.error('[VideoPlayer] Translation error:', error);
                  }
                  // If translation fails, don't show original - keep empty
                  // Only show original if user explicitly requests original language
                  if (videoLanguage === originalLanguage && originalTranscriptText) {
                    setTranscriptText(originalTranscriptText);
                    if (originalSubtitles.length > 0) {
                      setSubtitles(originalSubtitles);
                    }
                    setSubtitleLoading(false);
                  } else {
                    // Keep empty - user wants translated version, not original
                    setSubtitles([]);
                    setTranscriptText('');
                    setSubtitleLoading(false);
                  }
                } else {
                  setSubtitles([]);
                  if (!data.transcript) {
                    setTranscriptText('');
                  }
                }
              }
            }
          }
        } else {
          // Transcript not found for this language - try on-demand translation if we have an original
          if (
            originalTranscriptText &&
            originalLanguage &&
            videoLanguage !== originalLanguage
          ) {
            try {
              const tr = await fetch('/api/video/translate-on-demand', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contentId,
                  sourceLanguage: originalLanguage,
                  targetLanguage: videoLanguage,
                }),
              });
              if (tr.ok) {
                const trData = await tr.json();
                if (trData.transcript) {
                  setTranscriptText(trData.transcript);
                }
                if (trData.subtitles && Array.isArray(trData.subtitles) && trData.subtitles.length > 0) {
                  setSubtitles(trData.subtitles);
                  setSubtitleError(null);
                  return;
                }
              }
            } catch (error) {
              console.error('[VideoPlayer] Translation error:', error);
            }
            // If translation fails, don't show original - keep empty
            // Only show original if user explicitly requests original language
            if (videoLanguage === originalLanguage && originalTranscriptText) {
              setTranscriptText(originalTranscriptText);
              if (originalSubtitles.length > 0) {
                setSubtitles(originalSubtitles);
              }
              setSubtitleLoading(false);
            } else {
              // Keep empty - user wants translated version, not original
              setSubtitles([]);
              setTranscriptText('');
              setSubtitleError('Translation failed - no subtitles available');
              setSubtitleLoading(false);
            }
          } else {
            setSubtitles([]);
            setTranscriptText('');
          }
        }
      } catch (error: any) {
        console.error('[VideoPlayer] ✗ Fatal error loading subtitles:', error);
        setSubtitleError(`Fatal error: ${error.message || 'Unknown error'}`);
        setSubtitles([]);
        setTranscriptText('');
      } finally {
        setSubtitleLoading(false);
        console.log('[VideoPlayer] ===== Subtitle loading complete =====');
      }
    };

    loadSubtitles();
  }, [contentId, videoLanguage, originalLanguage, originalSubtitles.length]);

  // Check for existing translated video
  useEffect(() => {
    if (!contentId || !language) return;

    const checkTranslation = async () => {
      try {
        const res = await fetch(`/api/video/translate-audio?contentId=${contentId}&targetLanguage=${language}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed' && data.videoFile) {
            setTranslatedVideoSrc(data.videoFile);
            setTranslationStatus('completed');
          } else if (data.status === 'processing') {
            setTranslationStatus('processing');
            // Poll for completion
            pollTranslationStatus();
          } else {
            setTranslationStatus('not_started');
          }
        }
      } catch (error) {
        console.error('Failed to check translation:', error);
      }
    };

    checkTranslation();
  }, [contentId, language]);

  const pollTranslationStatus = async () => {
    const maxAttempts = 30; // 5 minutes max (10s intervals)
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setTranslationStatus('failed');
        return;
      }

      try {
        const res = await fetch(`/api/video/translate-audio?contentId=${contentId}&targetLanguage=${language}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed' && data.videoFile) {
            setTranslatedVideoSrc(data.videoFile);
            setTranslationStatus('completed');
          } else if (data.status === 'processing') {
            attempts++;
            setTimeout(poll, 10000); // Poll every 10 seconds
          } else if (data.status === 'failed') {
            setTranslationStatus('failed');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000);
        }
      }
    };

    setTimeout(poll, 10000);
  };

  // Translate video audio (not just subtitles)
  const handleTranslateVideo = async (targetLang: string) => {
    if (!contentId || translating) return;

    setTranslating(true);
    setTranslationStatus('processing');
    
    try {
      // Get source language (usually English for videos)
      const sourceLang = availableLanguages[0] || 'en';

      const res = await fetch('/api/video/translate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'completed' && data.videoFile) {
          // Translation already exists
          setTranslatedVideoSrc(data.videoFile);
          setTranslationStatus('completed');
        } else if (data.status === 'processing') {
          // Translation started, poll for completion
          pollTranslationStatus();
        }
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Translation failed' }));
        const errorMessage = errorData.error || 'Failed to start translation';
        
        // Show user-friendly error message
        if (errorMessage.includes('OpenAI') || errorMessage.includes('API key')) {
          alert(
            'Note: The system will automatically use free local transcription (no API key needed).\n\n' +
            'If you want faster/better quality, you can optionally:\n' +
            '1. Get an OpenAI API key from https://platform.openai.com/api-keys\n' +
            '2. Add it to your .env file: OPENAI_API_KEY=your_api_key_here\n' +
            '3. Restart your development server\n\n' +
            'Otherwise, the system will use free local Whisper for transcription.'
          );
        } else if (errorMessage.includes('FFmpeg')) {
          alert(
            'FFmpeg is required for video translation.\n\n' +
            'Please make sure FFmpeg is installed and FFMPEG_PATH is set in your .env file.'
          );
        } else {
          alert(`Translation failed: ${errorMessage}`);
        }
        
        setTranslationStatus('failed');
      }
    } catch (error: any) {
      console.error('Video translation failed:', error);
      alert('Translation failed. Please check the console for details.');
      setTranslationStatus('failed');
    } finally {
      setTranslating(false);
    }
  };

  // Update current subtitle based on video time
  useEffect(() => {
    const video = videoRef.current;
    
    // Don't update subtitles if loading - keep them cleared
    if (subtitleLoading) {
      setCurrentSubtitle('');
      return;
    }
    
    if (!video || subtitles.length === 0) {
      setCurrentSubtitle('');
      return;
    }

    // Clear current subtitle when subtitles change to force update
    setCurrentSubtitle('');

    const updateSubtitle = () => {
      const time = video.currentTime;
      const activeSubtitle = subtitles.find(
        (sub) => time >= sub.start && time <= sub.end
      );
      const newSubtitle = activeSubtitle?.text || '';
      setCurrentSubtitle(newSubtitle);
    };

    // Small delay to ensure subtitle state is cleared before updating
    const timeoutId = setTimeout(() => {
      updateSubtitle();
    }, 50);

    // Update on timeupdate
    video.addEventListener('timeupdate', updateSubtitle);
    return () => {
      clearTimeout(timeoutId);
      video.removeEventListener('timeupdate', updateSubtitle);
    };
  }, [subtitles, isFullscreen, subtitleLoading]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleFullscreenChange = () => {
      const container = containerRef.current;
      const isNowFullscreen = !!document.fullscreenElement && document.fullscreenElement === container;
      setIsFullscreen(isNowFullscreen);
      
      // Note: Fullscreen subtitle overlay is managed by React Portal, no manual cleanup needed
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);


  // Close language menu when clicking outside
  useEffect(() => {
    if (!showLanguageMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const languageMenu = document.querySelector('[data-language-menu]');
      const languageButton = document.querySelector('[data-language-button]');
      
      if (languageMenu && languageButton) {
        if (!languageMenu.contains(target) && !languageButton.contains(target)) {
          setShowLanguageMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLanguageMenu]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackRate(speed);
    setShowSpeedMenu(false);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!isFullscreen) {
      container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Use translated video if available, otherwise use original
  const videoSrc = translatedVideoSrc || src;

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full max-w-4xl mx-auto bg-black rounded-lg overflow-hidden ${
        isFullscreen ? 'max-w-none mx-0 rounded-none aspect-auto' : 'aspect-video'
      }`}
      style={isFullscreen ? { width: '100vw', height: '100vh', maxWidth: 'none' } : undefined}
    >
      {translationStatus === 'processing' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
          <div className="text-center text-white">
            <svg className="animate-spin h-8 w-8 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm">Translating video audio...</p>
            <p className="text-xs text-gray-400 mt-1">This may take a few minutes</p>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        src={videoSrc}
        className={`w-full h-full object-contain ${isFullscreen ? 'object-cover' : ''}`}
        style={isFullscreen ? { width: '100%', height: '100%' } : undefined}
        autoPlay={autoPlay}
        playsInline
        onClick={togglePlay}
        onError={(e) => {
          console.error('Video load error:', e);
          const video = e.currentTarget;
          if (video.error) {
            console.error('Video error details:', {
              code: video.error?.code,
              message: video.error?.message,
              src: videoSrc,
            });
          }
        }}
      />
      
      {/* Subtitles Overlay - Only show if not loading and subtitle exists */}
      {showSubtitles && !subtitleLoading && currentSubtitle && (
        <div 
          className={`absolute left-1/2 transform -translate-x-1/2 px-4 py-2 bg-black/75 text-white text-center rounded-lg z-50 ${
            isFullscreen 
              ? 'bottom-32 max-w-[90vw] text-xl' 
              : 'bottom-20 max-w-4xl text-lg'
          }`}
          style={{
            pointerEvents: 'none',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
          }}
        >
          <p className="font-medium">{currentSubtitle}</p>
        </div>
      )}
      
      {/* Subtitle loading indicator - Show where subtitles normally appear */}
      {showSubtitles && subtitleLoading && (
        <div 
          className={`absolute left-1/2 transform -translate-x-1/2 px-4 py-2 bg-blue-600/90 text-white text-center rounded-lg z-50 flex items-center gap-2 ${
            isFullscreen 
              ? 'bottom-32 max-w-[90vw] text-lg' 
              : 'bottom-20 max-w-4xl text-base'
          }`}
          style={{
            pointerEvents: 'none',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
          }}
        >
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-medium">Loading subtitles for {videoLanguage?.toUpperCase()}...</span>
        </div>
      )}
      
      {/* Subtitle error indicator */}
      {subtitleError && !subtitleLoading && (
        <div 
          className={`absolute left-1/2 transform -translate-x-1/2 px-4 py-2 bg-red-500/90 text-white text-center rounded-lg z-50 ${
            isFullscreen 
              ? 'bottom-32 max-w-[90vw] text-base' 
              : 'bottom-20 max-w-4xl text-sm'
          }`}
          style={{
            pointerEvents: 'none',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
          }}
        >
          <span>⚠ {subtitleError}</span>
        </div>
      )}

      {/* Custom Controls */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-3">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="p-2 hover:bg-white/20 rounded transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="p-2 hover:bg-white/20 rounded transition-colors"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.383 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.383l4.617-3.793a1 1 0 011.383.07zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.383 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.383l4.617-3.793a1 1 0 011.383.07zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
              </div>

              {/* Time Display */}
              <span className="text-sm font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Subtitles Toggle Button (YouTube style) - Always visible */}
              <button
                onClick={() => subtitles.length > 0 && setShowSubtitles(!showSubtitles)}
                className={`p-2 hover:bg-white/20 rounded transition-colors ${
                  showSubtitles && subtitles.length > 0 ? 'bg-white/30' : ''
                } ${subtitles.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label={subtitles.length === 0 ? 'No subtitles available' : (showSubtitles ? 'Hide subtitles (c)' : 'Show subtitles (c)')}
                title={subtitles.length === 0 ? 'No subtitles available' : (showSubtitles ? 'Hide subtitles (c)' : 'Show subtitles (c)')}
                disabled={subtitles.length === 0}
              >
                {showSubtitles && subtitles.length > 0 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12z"/>
                    <path d="M6.5 12.5h1.5V14h-1.5v-1.5zm0-2.5h1.5v1.5h-1.5V10zm2.5 2.5H10V14H9v-1.5zm0-2.5H10v1.5H9V10zm2.5 2.5h1.5V14H13v-1.5zm0-2.5h1.5v1.5H13V10zm2.5 2.5H17V14h-1.5v-1.5zm0-2.5H17v1.5h-1.5V10z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12z"/>
                    <path d="M6.5 12.5h11v1.5h-11v-1.5z"/>
                  </svg>
                )}
              </button>
              {/* Playback Speed */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 rounded transition-colors"
                >
                  {playbackRate}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-700 ${
                          playbackRate === speed ? 'bg-primary-600' : ''
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Language Selector & Translator */}
              {contentId && (
                <div className="relative">
                  {availableLanguages.length > 0 ? (
                    <>
                      <button
                        data-language-button
                        onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                        className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 rounded transition-colors flex items-center gap-1"
                        title="Change subtitle language"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.494 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clipRule="evenodd" />
                        </svg>
                        <span className="uppercase text-xs">{videoLanguage}</span>
                      </button>
                      {showLanguageMenu && (
                        <div data-language-menu className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10 min-w-[150px]">
                          {/* Available subtitle languages */}
                          {availableLanguages.map((lang) => {
                            const langNames: Record<string, string> = {
                              en: 'English',
                              ha: 'Hausa',
                              ig: 'Igbo',
                              yo: 'Yoruba',
                            };
                            const label =
                              originalLanguage && lang === originalLanguage
                                ? `Original (${langNames[lang] || lang.toUpperCase()})`
                                : langNames[lang] || lang.toUpperCase();
                            return (
                              <button
                                key={lang}
                                onClick={() => {
                                  console.log('[VideoPlayer] Language changed to:', lang);
                                  setVideoLanguage(lang);
                                  setShowLanguageMenu(false);
                                  if (onLanguageChange) {
                                    console.log('[VideoPlayer] Calling onLanguageChange with:', lang);
                                    onLanguageChange(lang);
                                  }
                                }}
                                className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-700 ${
                                  videoLanguage === lang ? 'bg-primary-600' : ''
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                          
                          {/* Video Audio Translator option if user's language not available */}
                          {!availableLanguages.includes(language) && language !== videoLanguage && (
                            <>
                              <div className="border-t border-gray-700 my-1"></div>
                              <button
                                onClick={async () => {
                                  setShowLanguageMenu(false);
                                  await handleTranslateVideo(language);
                                }}
                                disabled={translating || translationStatus === 'processing'}
                                className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-primary-400 disabled:opacity-50"
                              >
                                {translating || translationStatus === 'processing' ? (
                                  <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Translating audio...
                                  </span>
                                ) : translationStatus === 'completed' ? (
                                  <span className="flex items-center gap-2 text-green-400">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Playing in {language === 'ha' ? 'Hausa' : language === 'ig' ? 'Igbo' : language === 'yo' ? 'Yoruba' : language.toUpperCase()}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.494 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clipRule="evenodd" />
                                    </svg>
                                    Translate audio to {language === 'ha' ? 'Hausa' : language === 'ig' ? 'Igbo' : language === 'yo' ? 'Yoruba' : language.toUpperCase()}
                                  </span>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    // Show audio translation button when no subtitles are available
                    <button
                      onClick={async () => {
                        await handleTranslateVideo(language);
                      }}
                      disabled={translating || translationStatus === 'processing'}
                      className="px-3 py-1 text-sm bg-primary-600 hover:bg-primary-700 rounded transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Translate video audio to your preferred language"
                    >
                      {translating || translationStatus === 'processing' ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-xs">Translating...</span>
                        </>
                      ) : translationStatus === 'completed' ? (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs uppercase">{language === 'ha' ? 'Hausa' : language === 'ig' ? 'Igbo' : language === 'yo' ? 'Yoruba' : language}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.494 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs">Translate to {language === 'ha' ? 'Hausa' : language === 'ig' ? 'Igbo' : language === 'yo' ? 'Yoruba' : language.toUpperCase()}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-white/20 rounded transition-colors"
                aria-label="Fullscreen"
              >
                {isFullscreen ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v4a1 1 0 102 0V4h4a1 1 0 100-2H4zm12 0a1 1 0 100 2h-4a1 1 0 100-2h4zm-6 8a1 1 0 011 1v4a1 1 0 11-2 0v-4a1 1 0 011-1zm-8 4a2 2 0 002 2h4a1 1 0 110 2H4a2 2 0 01-2-2v-4a1 1 0 112 0v4zm14-4a1 1 0 112 0v4a2 2 0 01-2 2h-4a1 1 0 110-2h4v-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

