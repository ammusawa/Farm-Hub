import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getAuthUser } from '@/lib/auth';

// Configure route to handle large file uploads (1GB)
export const maxDuration = 300; // 5 minutes for large uploads
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const videoFile = formData.get('video') as File;

    if (!videoFile) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      );
    }

    // Validate file size (max 1GB)
    const maxSize = 1024 * 1024 * 1024; // 1GB
    if (videoFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Video file exceeds 1GB limit' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'video/x-msvideo', // AVI
    ];
    
    if (!allowedTypes.includes(videoFile.type)) {
      return NextResponse.json(
        { error: `Invalid video format. Allowed: MP4, WebM, OGG, MOV, AVI` },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'videos');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = videoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileExtension = videoFile.name.split('.').pop() || 'mp4';
    const fileName = `${user.id}_${timestamp}_${sanitizedName}`;
    const filePath = join(uploadsDir, fileName);

    // Convert file to buffer and save
    const bytes = await videoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Store relative path for database
    const relativePath = `/uploads/videos/${fileName}`;

    return NextResponse.json({
      success: true,
      filePath: relativePath,
      fileName: videoFile.name,
      fileSize: videoFile.size,
    });
  } catch (error: any) {
    console.error('Video upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload video' },
      { status: 500 }
    );
  }
}

