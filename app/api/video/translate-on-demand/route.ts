import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { translateText, translateBatch } from '@/lib/translate';

// Translate video transcript on-demand with caching and chunked translation
export async function POST(request: NextRequest) {
  try {
    const { contentId, sourceLanguage, targetLanguage, force } = await request.json();

    if (!contentId || !sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        { error: 'Content ID, source language, and target language are required' },
        { status: 400 }
      );
    }

    // Get source transcript first (needed for comparison)
    const [transcripts] = await pool.execute(
      'SELECT transcript, subtitles FROM video_transcripts WHERE contentId = ? AND language = ?',
      [contentId, sourceLanguage]
    ) as any[];

    if (!transcripts || transcripts.length === 0) {
      return NextResponse.json(
        { error: 'Source transcript not found' },
        { status: 404 }
      );
    }

    const sourceTranscript = transcripts[0].transcript;

    // Check if translation already exists in database (cache)
    const [existing] = await pool.execute(
      'SELECT transcript, subtitles FROM video_transcripts WHERE contentId = ? AND language = ?',
      [contentId, targetLanguage]
    ) as any[];

    // Only use cache if it exists AND is different from source (actually translated) AND force is not true
    if (!force && existing && existing.length > 0 && existing[0].transcript) {
      const cachedTranscript = existing[0].transcript;
      
      // Compare with source - if they're the same, it's not a real translation
      if (cachedTranscript !== sourceTranscript && cachedTranscript.trim() !== sourceTranscript.trim()) {
        console.log(`[translate-on-demand] Found valid cached translation for ${targetLanguage}`);
        return NextResponse.json({
          success: true,
          transcript: cachedTranscript,
          subtitles: existing[0].subtitles ? JSON.parse(existing[0].subtitles) : null,
          language: targetLanguage,
          cached: true,
        });
      } else {
        console.log(`[translate-on-demand] Cached transcript for ${targetLanguage} is same as source - forcing fresh translation`);
        // Delete the invalid cache entry
        await pool.execute(
          'DELETE FROM video_transcripts WHERE contentId = ? AND language = ?',
          [contentId, targetLanguage]
        ).catch(err => {
          console.error('[translate-on-demand] Failed to delete invalid cache:', err);
        });
      }
    } else if (force) {
      console.log(`[translate-on-demand] Force flag set - bypassing cache and translating fresh`);
    }

    const sourceSubtitles = transcripts[0].subtitles ? JSON.parse(transcripts[0].subtitles) : null;

    // Translate transcript and subtitles in parallel for speed
    const translationPromises: Promise<any>[] = [
      translateText(sourceTranscript, sourceLanguage, targetLanguage)
    ];

    // If subtitles exist, translate them in chunks for faster response
    let translatedSubtitles = null;
    if (sourceSubtitles && Array.isArray(sourceSubtitles) && sourceSubtitles.length > 0) {
      console.log(`[translate-on-demand] Translating ${sourceSubtitles.length} subtitles from ${sourceLanguage} to ${targetLanguage}`);
      
      // Chunk subtitles into batches of 50 for faster translation
      const CHUNK_SIZE = 50;
      const subtitleTexts = sourceSubtitles.map((sub: any) => sub.text);
      const chunks: string[][] = [];
      
      for (let i = 0; i < subtitleTexts.length; i += CHUNK_SIZE) {
        chunks.push(subtitleTexts.slice(i, i + CHUNK_SIZE));
      }

      console.log(`[translate-on-demand] Split into ${chunks.length} chunks for faster translation`);

      // Translate chunks in parallel
      const chunkPromises = chunks.map((chunk, index) => 
        translateBatch(chunk, sourceLanguage, targetLanguage).then(translated => ({
          index,
          translated
        }))
      );

      const chunkResults = await Promise.all(chunkPromises);
      
      // Reassemble translated texts in order
      const translatedTexts: string[] = [];
      chunkResults
        .sort((a, b) => a.index - b.index)
        .forEach(result => {
          translatedTexts.push(...result.translated);
        });
      
      translatedSubtitles = sourceSubtitles.map((sub: any, index: number) => ({
        ...sub,
        text: translatedTexts[index] || sub.text,
      }));
      
      console.log(`[translate-on-demand] Successfully translated ${translatedSubtitles.length} subtitles`);
    }

    // Wait for transcript translation
    const translatedText = await translationPromises[0];

    // Save translated transcript to database for caching (async, don't wait)
    pool.execute(
      `INSERT INTO video_transcripts (contentId, language, transcript, subtitles)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       transcript = VALUES(transcript),
       subtitles = VALUES(subtitles),
       updatedAt = CURRENT_TIMESTAMP`,
      [
        contentId,
        targetLanguage,
        translatedText,
        translatedSubtitles ? JSON.stringify(translatedSubtitles) : null,
      ]
    ).catch(err => {
      console.error('[translate-on-demand] Failed to cache translation:', err);
      // Don't fail the request if caching fails
    });

    return NextResponse.json({
      success: true,
      transcript: translatedText,
      subtitles: translatedSubtitles,
      language: targetLanguage,
      cached: false,
    });
  } catch (error: any) {
    console.error('[translate-on-demand] Error:', error);
    const errorMessage = error.message || 'Failed to translate transcript';
    
    // Provide helpful error message if translation service is not available
    let userFriendlyError = errorMessage;
    if (errorMessage.includes('Translation service is not available') || 
        errorMessage.includes('not responding') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('localhost:5000')) {
      userFriendlyError = `Translation service is not running. Please start the Python translation service by running: python translator_service.py`;
    }
    
    return NextResponse.json(
      { error: userFriendlyError },
      { status: 500 }
    );
  }
}


