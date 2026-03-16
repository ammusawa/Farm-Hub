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

    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'User ID and role are required' },
        { status: 400 }
      );
    }

    if (!['admin', 'user', 'professional'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Prevent removing yourself as admin
    if (userId === user.id && role !== 'admin') {
      return NextResponse.json(
        { error: 'You cannot remove your own admin status' },
        { status: 400 }
      );
    }

    // Update user role
    // For admins, always set isVerifiedProfessional to false
    // For professionals, set to false (they need verification)
    // For regular users, set to false
    const isVerified = role === 'admin' ? false : (role === 'professional' ? false : false);
    
    await pool.execute(
      `UPDATE users
       SET role = ?, isVerifiedProfessional = ?
       WHERE id = ?`,
      [role, isVerified, userId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update user role' },
      { status: 500 }
    );
  }
}

