import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { translateText, translateBatch } from '@/lib/translate';

// Translate video transcript from one language to another
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { contentId, sourceLanguage, targetLanguage } = await request.json();

    if (!contentId || !sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        { error: 'Content ID, source language, and target language are required' },
        { status: 400 }
      );
    }

    // Get source transcript
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
    const sourceSubtitles = transcripts[0].subtitles ? JSON.parse(transcripts[0].subtitles) : null;

    // Translate transcript using Google Translate API
    const translatedText = await translateText(sourceTranscript, sourceLanguage, targetLanguage);

    // If subtitles exist, translate them too (batch translation for efficiency)
    let translatedSubtitles = null;
    if (sourceSubtitles && Array.isArray(sourceSubtitles)) {
      const subtitleTexts = sourceSubtitles.map((sub: any) => sub.text);
      const translatedTexts = await translateBatch(subtitleTexts, sourceLanguage, targetLanguage);
      
      translatedSubtitles = sourceSubtitles.map((sub: any, index: number) => ({
        ...sub,
        text: translatedTexts[index] || sub.text,
      }));
    }

    // Save translated transcript
    await pool.execute(
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
    );

    return NextResponse.json({
      success: true,
      transcript: translatedText,
      subtitles: translatedSubtitles,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to translate transcript' },
      { status: 500 }
    );
  }
}


