import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, generateToken, setAuthCookie } from '@/lib/auth';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get fresh user data from database
    const [users] = await pool.execute(
      'SELECT id, name, email, role, isVerifiedProfessional FROM users WHERE id = ?',
      [user.id]
    ) as any[];

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const freshUser = users[0];
    
    // For admins, always set isVerifiedProfessional to false
    const isVerifiedProfessional = freshUser.role === 'admin' ? false : (freshUser.isVerifiedProfessional || false);

    // Generate new token with fresh data
    const token = generateToken({
      id: freshUser.id,
      email: freshUser.email,
      role: freshUser.role,
      isVerifiedProfessional: isVerifiedProfessional,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: freshUser.id,
        name: freshUser.name,
        email: freshUser.email,
        role: freshUser.role,
        isVerifiedProfessional: freshUser.isVerifiedProfessional,
      },
    });

    response.headers.set('Set-Cookie', setAuthCookie(token));

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to refresh token' },
      { status: 500 }
    );
  }
}

