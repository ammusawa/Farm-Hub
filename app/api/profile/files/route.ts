import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId');

    if (!applicationId) {
      return NextResponse.json(
        { error: 'Application ID required' },
        { status: 400 }
      );
    }

    // Verify the application belongs to the user
    const [apps] = await pool.execute(
      'SELECT userId FROM professional_applications WHERE id = ?',
      [applicationId]
    ) as any[];

    if (!apps || apps.length === 0 || apps[0].userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get files for this application
    const [files] = await pool.execute(
      'SELECT * FROM professional_files WHERE applicationId = ? ORDER BY uploadedAt DESC',
      [applicationId]
    );

    return NextResponse.json({ files });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch files' },
      { status: 500 }
    );
  }
}

