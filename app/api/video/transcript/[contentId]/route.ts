import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Get transcript for a video in a specific language
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> | { contentId: string } }
) {
  try {
    // Handle both Next.js 14+ (Promise) and older versions
    const resolvedParams = params instanceof Promise ? await params : params;
    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language') || 'en';

    const [transcripts] = await pool.execute(
      'SELECT transcript, subtitles FROM video_transcripts WHERE contentId = ? AND language = ?',
      [resolvedParams.contentId, language]
    ) as any[];

    if (!transcripts || transcripts.length === 0) {
      // Return empty response instead of 404 - this is expected when transcript doesn't exist
      return NextResponse.json({
        transcript: null,
        subtitles: null,
        language,
        message: 'No transcript available for this language',
      });
    }

    const transcript = transcripts[0];
    return NextResponse.json({
      transcript: transcript.transcript,
      subtitles: transcript.subtitles ? JSON.parse(transcript.subtitles) : null,
      language,
    });
  } catch (error: any) {
    console.error('Transcript API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}

