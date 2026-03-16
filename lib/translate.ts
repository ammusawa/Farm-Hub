/**
 * Translation service integration
 *
 * This implementation uses a local Python translation service that runs
 * Helsinki-NLP OPUS-MT models locally using the transformers library.
 *
 * Configure the following environment variable:
 * - TRANSLATOR_SERVICE_URL (optional, defaults to http://localhost:5000)
 *
 * The Python translation service must be running separately.
 * Start it with: python translator_service.py
 */

const TRANSLATOR_SERVICE_URL = process.env.TRANSLATOR_SERVICE_URL || 'http://localhost:5000';
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

const SUPPORTED_LANGUAGES = new Set(['en', 'ha', 'ig', 'yo']);

type CacheEntry = {
  value: string;
  expiresAt: number;
};

const translationCache = new Map<string, CacheEntry>();

// Check if translation service is available
async function checkServiceHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check
    
    try {
      const response = await fetch(`${TRANSLATOR_SERVICE_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  } catch {
    return false;
  }
}

async function callTranslationService(inputs: string[], sourceLang: string, targetLang: string): Promise<string[]> {
  // First check if service is available
  const isHealthy = await checkServiceHealth();
  if (!isHealthy) {
    throw new Error(`Translation service is not available at ${TRANSLATOR_SERVICE_URL}. Please ensure the Python translation service is running.`);
  }

  try {
    // Create an AbortController for timeout handling
    // Use a longer timeout for batch translations (10 minutes)
    const timeoutMs = inputs.length > 1 ? 600000 : 300000; // 10 min for batch, 5 min for single
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(`${TRANSLATOR_SERVICE_URL}/translate/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: inputs,
          sourceLang,
          targetLang,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Translation service error' }));
        throw new Error(error.error || `Translation service returned ${response.status}`);
      }

      const data = await response.json();
      const translated = data.translatedTexts || inputs;
      
      // Log translation results for debugging
      if (inputs.length === 1 && translated.length === 1) {
        const original = inputs[0];
        const result = translated[0];
        if (original === result || original.trim() === result.trim()) {
          console.warn(`[Translation] Service returned same text as input for ${sourceLang} -> ${targetLang}. Translation may have failed.`);
          console.warn(`[Translation] Original length: ${original.length}, Result length: ${result.length}`);
        } else {
          console.log(`[Translation] Successfully translated ${sourceLang} -> ${targetLang}, length: ${original.length} -> ${result.length}`);
        }
      }
      
      return translated;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError' || fetchError.cause?.code === 'UND_ERR_HEADERS_TIMEOUT') {
        throw new Error(`Translation request timed out after ${timeoutMs / 1000} seconds. The service may be processing a long text or is busy. Please try again with a shorter text or wait a moment.`);
      }
      throw fetchError;
    }
  } catch (error: any) {
    // Check if it's a connection error
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED') || error.cause?.code === 'UND_ERR_HEADERS_TIMEOUT') {
      console.error('[Translation] Service connection error. Is the translation service running?', error.message || error);
      throw new Error(`Translation service is not responding at ${TRANSLATOR_SERVICE_URL}. Please ensure the Python translation service is running.`);
    }
    console.error('[Translation] Service error:', error.message || error);
    throw error;
  }
}

async function translateWithCache(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const cacheKey = `${sourceLang}:${targetLang}:${text}`;
  const now = Date.now();
  const cached = translationCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const [translated] = await callTranslationService([text], sourceLang, targetLang);
    const value = translated || text;
    translationCache.set(cacheKey, { value, expiresAt: now + CACHE_TTL_MS });
    return value;
  } catch (error: any) {
    console.error(`[Translation] Failed to translate ${sourceLang} -> ${targetLang}:`, error);
    return text; // Return original text on error
  }
}

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const from = (sourceLang || '').toLowerCase();
  const to = (targetLang || '').toLowerCase();

  if (!text || !text.trim() || !from || !to || from === to) {
    return text;
  }

  if (!SUPPORTED_LANGUAGES.has(from) || !SUPPORTED_LANGUAGES.has(to)) {
    console.warn(`[Translation] Unsupported language pair: ${from} -> ${to}`);
    return text;
  }

  return await translateWithCache(text, from, to);
}

export async function translateBatch(
  texts: string[],
  sourceLang: string,
  targetLang: string
): Promise<string[]> {
  if (!texts.length) {
    return [];
  }

  const from = (sourceLang || '').toLowerCase();
  const to = (targetLang || '').toLowerCase();

  if (!from || !to || from === to) {
    return texts;
  }

  if (!SUPPORTED_LANGUAGES.has(from) || !SUPPORTED_LANGUAGES.has(to)) {
    return texts;
  }

  try {
    // Check cache first
    const results: string[] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    texts.forEach((text, index) => {
      if (!text || !text.trim()) {
        results[index] = text;
        return;
      }

      const cacheKey = `${from}:${to}:${text}`;
      const now = Date.now();
      const cached = translationCache.get(cacheKey);

      if (cached && cached.expiresAt > now) {
        results[index] = cached.value;
      } else {
        uncachedTexts.push(text);
        uncachedIndices.push(index);
      }
    });

    // Translate uncached texts
    if (uncachedTexts.length > 0) {
      const translated = await callTranslationService(uncachedTexts, from, to);
      const now = Date.now();

      uncachedIndices.forEach((originalIndex, i) => {
        const text = uncachedTexts[i];
        const translatedText = translated[i] || text;
        results[originalIndex] = translatedText;

        // Cache the result
        const cacheKey = `${from}:${to}:${text}`;
        translationCache.set(cacheKey, { value: translatedText, expiresAt: now + CACHE_TTL_MS });
      });
    }

    return results;
  } catch (error: any) {
    console.error(`[Translation] Batch translation failed ${from} -> ${to}:`, error);
    return texts; // Return original texts on error
  }
}
