import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

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

    // Get all comments with user info, ordered by creation time
    const [rows] = await pool.execute(
      `SELECT c.*, u.name as userName
       FROM comments c
       LEFT JOIN users u ON c.userId = u.id
       WHERE c.contentId = ?
       ORDER BY c.createdAt ASC`,
      [contentId]
    );

    // Organize into threaded structure
    const comments = rows as any[];
    const commentMap = new Map();
    const rootComments: any[] = [];

    comments.forEach((comment) => {
      comment.replies = [];
      commentMap.set(comment.id, comment);
    });

    comments.forEach((comment) => {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });

    return NextResponse.json({ comments: rootComments });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { contentId, parentId, message } = await request.json();

    if (!contentId || !message) {
      return NextResponse.json(
        { error: 'Content ID and message are required' },
        { status: 400 }
      );
    }

    const [result] = await pool.execute(
      `INSERT INTO comments (userId, contentId, parentId, message)
       VALUES (?, ?, ?, ?)`,
      [user.id, contentId, parentId || null, message]
    ) as any;

    // Fetch the created comment with user info
    const [comments] = await pool.execute(
      `SELECT c.*, u.name as userName
       FROM comments c
       LEFT JOIN users u ON c.userId = u.id
       WHERE c.id = ?`,
      [result.insertId]
    ) as any[];

    return NextResponse.json({
      success: true,
      comment: comments[0],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create comment' },
      { status: 500 }
    );
  }
}

