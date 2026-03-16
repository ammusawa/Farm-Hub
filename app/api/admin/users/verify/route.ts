import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { userId, action, adminNotes } = await request.json();

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'User ID and action are required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Get user to verify they are a professional
    const [users] = await pool.execute(
      'SELECT id, role FROM users WHERE id = ?',
      [userId]
    ) as any[];

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (users[0].role !== 'professional') {
      return NextResponse.json(
        { error: 'User is not a professional' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Update user to verified
      await pool.execute(
        `UPDATE users
         SET isVerifiedProfessional = TRUE
         WHERE id = ?`,
        [userId]
      );

      // Update or create professional application
      const [apps] = await pool.execute(
        'SELECT id FROM professional_applications WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
        [userId]
      ) as any[];

      if (apps && apps.length > 0) {
        await pool.execute(
          `UPDATE professional_applications
           SET status = 'approved', adminNotes = ?, updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [adminNotes || null, apps[0].id]
        );
      } else {
        // Create application record if it doesn't exist
        await pool.execute(
          `INSERT INTO professional_applications (userId, status, adminNotes)
           VALUES (?, 'approved', ?)`,
          [userId, adminNotes || null]
        );
      }
    } else if (action === 'reject') {
      // Update user to not verified
      await pool.execute(
        `UPDATE users
         SET isVerifiedProfessional = FALSE
         WHERE id = ?`,
        [userId]
      );

      // Update professional application
      const [apps] = await pool.execute(
        'SELECT id FROM professional_applications WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
        [userId]
      ) as any[];

      if (apps && apps.length > 0) {
        await pool.execute(
          `UPDATE professional_applications
           SET status = 'rejected', adminNotes = ?, updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [adminNotes || null, apps[0].id]
        );
      } else {
        // Create application record if it doesn't exist
        await pool.execute(
          `INSERT INTO professional_applications (userId, status, adminNotes)
           VALUES (?, 'rejected', ?)`,
          [userId, adminNotes || null]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update professional status' },
      { status: 500 }
    );
  }
}

