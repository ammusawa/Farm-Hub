import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ user: null });
    }

    // Get fresh user data
    const [users] = await pool.execute(
      'SELECT id, name, email, role, isVerifiedProfessional FROM users WHERE id = ?',
      [user.id]
    ) as any[];

    if (!users || users.length === 0) {
      return NextResponse.json({ user: null });
    }

    const userData = users[0];
    // For admins, isVerifiedProfessional should always be false
    if (userData.role === 'admin') {
      userData.isVerifiedProfessional = false;
    }

    return NextResponse.json({ user: userData });
  } catch (error) {
    return NextResponse.json({ user: null });
  }
}

