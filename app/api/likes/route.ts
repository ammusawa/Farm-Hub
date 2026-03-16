import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// Toggle like/dislike for content
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { contentId, type } = await request.json();

    if (!contentId || !type || !['like', 'dislike'].includes(type)) {
      return NextResponse.json(
        { error: 'Content ID and type (like/dislike) are required' },
        { status: 400 }
      );
    }

    // Check if user already has a like/dislike for this content
    const [existing] = await pool.execute(
      'SELECT id, type FROM content_likes WHERE userId = ? AND contentId = ?',
      [user.id, contentId]
    ) as any[];

    if (existing && existing.length > 0) {
      const existingLike = existing[0];
      
      // If clicking the same type, remove it (toggle off)
      if (existingLike.type === type) {
        await pool.execute(
          'DELETE FROM content_likes WHERE userId = ? AND contentId = ?',
          [user.id, contentId]
        );
        return NextResponse.json({ 
          action: 'removed',
          type: null 
        });
      } else {
        // If clicking different type, update it
        await pool.execute(
          'UPDATE content_likes SET type = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND contentId = ?',
          [type, user.id, contentId]
        );
        return NextResponse.json({ 
          action: 'updated',
          type 
        });
      }
    } else {
      // Create new like/dislike
      await pool.execute(
        'INSERT INTO content_likes (userId, contentId, type) VALUES (?, ?, ?)',
        [user.id, contentId, type]
      );
      return NextResponse.json({ 
        action: 'added',
        type 
      });
    }
  } catch (error: any) {
    console.error('Like/dislike error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update like/dislike' },
      { status: 500 }
    );
  }
}

// Get like/dislike counts and user's current reaction
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('contentId');

    if (!contentId) {
      return NextResponse.json(
        { error: 'Content ID is required' },
        { status: 400 }
      );
    }

    // Get like and dislike counts
    const [likes] = await pool.execute(
      'SELECT COUNT(*) as count FROM content_likes WHERE contentId = ? AND type = "like"',
      [contentId]
    ) as any[];

    const [dislikes] = await pool.execute(
      'SELECT COUNT(*) as count FROM content_likes WHERE contentId = ? AND type = "dislike"',
      [contentId]
    ) as any[];

    // Get user's current reaction if authenticated
    let userReaction = null;
    try {
      const user = await getAuthUser(request);
      if (user) {
        const [userLike] = await pool.execute(
          'SELECT type FROM content_likes WHERE userId = ? AND contentId = ?',
          [user.id, contentId]
        ) as any[];
        
        if (userLike && userLike.length > 0) {
          userReaction = userLike[0].type;
        }
      }
    } catch (error) {
      // User not authenticated, that's fine
    }

    return NextResponse.json({
      likes: likes[0]?.count || 0,
      dislikes: dislikes[0]?.count || 0,
      userReaction,
    });
  } catch (error: any) {
    console.error('Get likes error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get likes' },
      { status: 500 }
    );
  }
}

