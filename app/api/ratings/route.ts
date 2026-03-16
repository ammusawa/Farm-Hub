import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { contentId, stars } = await request.json();

    if (!contentId || !stars || stars < 1 || stars > 5) {
      return NextResponse.json(
        { error: 'Invalid rating' },
        { status: 400 }
      );
    }

    // Upsert rating
    await pool.execute(
      `INSERT INTO ratings (userId, contentId, stars)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE stars = ?`,
      [user.id, contentId, stars, stars]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to submit rating' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('contentId');

    if (!contentId) {
      return NextResponse.json(
        { error: 'Content ID required' },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute(
      `SELECT AVG(stars) as avgRating, COUNT(*) as count
       FROM ratings WHERE contentId = ?`,
      [contentId]
    ) as any[];

    return NextResponse.json({
      avgRating: rows[0]?.avgRating || 0,
      count: rows[0]?.count || 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch ratings' },
      { status: 500 }
    );
  }
}

