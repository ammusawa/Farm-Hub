import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Translate video audio from one language to another
// This endpoint initiates the translation process
export async function POST(request: NextRequest) {
  try {
    const { contentId, sourceLanguage, targetLanguage } = await request.json();

    if (!contentId || !sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        { error: 'Content ID, source language, and target language are required' },
        { status: 400 }
      );
    }

    // Get video file path
    const [contents] = await pool.execute(
      'SELECT videoFile FROM content WHERE id = ?',
      [contentId]
    ) as any[];

    if (!contents || contents.length === 0 || !contents[0].videoFile) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const videoFilePath = contents[0].videoFile;

    // Check if translated video already exists
    const [existing] = await pool.execute(
      'SELECT translatedVideoFile FROM content_translations WHERE contentId = ? AND targetLanguage = ?',
      [contentId, targetLanguage]
    ) as any[];

    if (existing && existing.length > 0 && existing[0].translatedVideoFile) {
      return NextResponse.json({
        success: true,
        videoFile: existing[0].translatedVideoFile,
        status: 'completed',
        message: 'Translated video already exists',
      });
    }

    // For MVP, we'll use a service that can handle video translation
    // This is a placeholder - in production, integrate with:
    // - Google Cloud Video Intelligence API
    // - AWS Transcribe + Translate + Polly + MediaConvert
    // - Or a service like Deepgram, AssemblyAI, etc.
    
    // Start async translation process
    // In a real implementation, this would queue a job
    const translationJobId = await startVideoTranslation(
      videoFilePath,
      contentId,
      sourceLanguage,
      targetLanguage
    );

    return NextResponse.json({
      success: true,
      jobId: translationJobId,
      status: 'processing',
      message: 'Video translation started. This may take a few minutes.',
    });
  } catch (error: any) {
    console.error('Video translation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start video translation' },
      { status: 500 }
    );
  }
}

// Check translation status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('contentId');
    const targetLanguage = searchParams.get('targetLanguage');

    if (!contentId || !targetLanguage) {
      return NextResponse.json(
        { error: 'Content ID and target language are required' },
        { status: 400 }
      );
    }

    const [translations] = await pool.execute(
      'SELECT translatedVideoFile, status FROM content_translations WHERE contentId = ? AND targetLanguage = ?',
      [contentId, targetLanguage]
    ) as any[];

    if (!translations || translations.length === 0) {
      return NextResponse.json({
        status: 'not_started',
        videoFile: null,
      });
    }

    const translation = translations[0];
    return NextResponse.json({
      status: translation.status || 'processing',
      videoFile: translation.translatedVideoFile,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to check translation status' },
      { status: 500 }
    );
  }
}

// Start video translation process
async function startVideoTranslation(
  videoFilePath: string,
  contentId: number,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  // Create translation record
  await pool.execute(
    `INSERT INTO content_translations (contentId, sourceLanguage, targetLanguage, status)
     VALUES (?, ?, ?, 'pending')
     ON DUPLICATE KEY UPDATE status = 'pending', updatedAt = CURRENT_TIMESTAMP`,
    [contentId, sourceLanguage, targetLanguage]
  );

  const jobId = `translation_${contentId}_${targetLanguage}_${Date.now()}`;
  
  // Start background processing (in production, use a job queue like Bull, BullMQ, etc.)
  // For now, we'll process it immediately (this should be async in production)
  processVideoTranslationAsync(contentId, sourceLanguage, targetLanguage, videoFilePath);
  
  return jobId;
}

// Process video translation asynchronously
async function processVideoTranslationAsync(
  contentId: number,
  sourceLanguage: string,
  targetLanguage: string,
  videoFilePath: string
) {
  try {
    // Call the processing endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/video/translate-audio/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentId,
        sourceLanguage,
        targetLanguage,
        videoFilePath,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Video translation process failed:', errorData);
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Video translation completed:', result);
  } catch (error: any) {
    console.error('Failed to process video translation:', error);
    // Update status to failed
    try {
      await pool.execute(
        `UPDATE content_translations 
         SET status = 'failed', updatedAt = CURRENT_TIMESTAMP
         WHERE contentId = ? AND targetLanguage = ?`,
        [contentId, targetLanguage]
      );
    } catch (dbError) {
      console.error('Failed to update translation status in database:', dbError);
    }
  }
}

