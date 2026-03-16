import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// This endpoint handles video transcription and translation
// For MVP, we'll accept manual transcript uploads and auto-translate them

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { contentId, language, transcript, subtitles } = await request.json();

    if (!contentId || !language || !transcript) {
      return NextResponse.json(
        { error: 'Content ID, language, and transcript are required' },
        { status: 400 }
      );
    }

    // Verify content belongs to user or user is admin
    const [contents] = await pool.execute(
      'SELECT authorId FROM content WHERE id = ?',
      [contentId]
    ) as any[];

    if (!contents || contents.length === 0) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      );
    }

    if (contents[0].authorId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized to modify this content' },
        { status: 403 }
      );
    }

    // Insert or update transcript
    await pool.execute(
      `INSERT INTO video_transcripts (contentId, language, transcript, subtitles)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       transcript = VALUES(transcript),
       subtitles = VALUES(subtitles),
       updatedAt = CURRENT_TIMESTAMP`,
      [contentId, language, transcript, subtitles ? JSON.stringify(subtitles) : null]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to save transcript' },
      { status: 500 }
    );
  }
}

