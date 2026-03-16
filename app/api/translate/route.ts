import { NextRequest, NextResponse } from 'next/server';

const TRANSLATOR_SERVICE_URL = process.env.TRANSLATOR_SERVICE_URL || 'http://localhost:5000';

/**
 * Translation API route that calls the local Python translation service
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, texts, sourceLang, targetLang } = body;

    // Validate input
    if (!sourceLang || !targetLang) {
      return NextResponse.json(
        { error: 'sourceLang and targetLang are required' },
        { status: 400 }
      );
    }

    // Single text translation
    if (text) {
      const response = await fetch(`${TRANSLATOR_SERVICE_URL}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          sourceLang,
          targetLang,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Translation service error' }));
        return NextResponse.json(error, { status: response.status });
      }

      const data = await response.json();
      return NextResponse.json({ translatedText: data.translatedText });
    }

    // Batch translation
    if (texts && Array.isArray(texts)) {
      const response = await fetch(`${TRANSLATOR_SERVICE_URL}/translate/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts,
          sourceLang,
          targetLang,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Translation service error' }));
        return NextResponse.json(error, { status: response.status });
      }

      const data = await response.json();
      return NextResponse.json({ translatedTexts: data.translatedTexts });
    }

    return NextResponse.json(
      { error: 'Either text or texts array is required' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: error.message || 'Translation failed' },
      { status: 500 }
    );
  }
}

