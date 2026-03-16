import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Get available languages for a video transcript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> | { contentId: string } }
) {
  try {
    // Handle both Next.js 14+ (Promise) and older versions
    const resolvedParams = params instanceof Promise ? await params : params;
    // Get all languages, ordered by creation date (first uploaded is original)
    const [rows] = await pool.execute(
      'SELECT language, createdAt FROM video_transcripts WHERE contentId = ? ORDER BY createdAt ASC',
      [resolvedParams.contentId]
    ) as any[];

    const languages = rows.map((row: any) => row.language);
    // The first language (earliest createdAt) is the original uploaded transcript
    const originalLanguage = rows.length > 0 ? rows[0].language : null;
    
    return NextResponse.json({ 
      languages: languages.length > 0 ? languages : [],
      originalLanguage: originalLanguage
    });
  } catch (error: any) {
    console.error('Languages API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch available languages', languages: [] },
      { status: 500 }
    );
  }
}

