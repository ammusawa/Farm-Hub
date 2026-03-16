import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { unlink } from 'fs/promises';
import { join } from 'path';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get file info
    const [files] = await pool.execute(
      `SELECT pf.*, pa.userId 
       FROM professional_files pf
       JOIN professional_applications pa ON pf.applicationId = pa.id
       WHERE pf.id = ?`,
      [params.id]
    ) as any[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const file = files[0];

    // Verify the file belongs to the user
    if (file.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete file from filesystem
    try {
      const filePath = join(process.cwd(), 'public', file.filePath);
      await unlink(filePath);
    } catch (error) {
      console.error('Failed to delete file from filesystem:', error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await pool.execute(
      'DELETE FROM professional_files WHERE id = ?',
      [params.id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete file' },
      { status: 500 }
    );
  }
}

