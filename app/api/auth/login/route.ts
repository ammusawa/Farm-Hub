import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyPassword, generateToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const [users] = await pool.execute(
      'SELECT id, name, email, password, role, isVerifiedProfessional FROM users WHERE email = ?',
      [email]
    ) as any[];

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = users[0];

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate token
    // For admins, isVerifiedProfessional should always be false
    const isVerifiedProfessional = user.role === 'admin' ? false : (user.isVerifiedProfessional || false);
    
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      isVerifiedProfessional: isVerifiedProfessional,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerifiedProfessional: isVerifiedProfessional,
      },
    });

    response.headers.set('Set-Cookie', setAuthCookie(token));

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}

