import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, userType } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // Determine role based on userType
    const role = userType === 'professional' ? 'professional' : 'user';

    // Create user
    const hashedPassword = await hashPassword(password);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    ) as any;

    const userId = result.insertId;

    // Generate token
    const token = generateToken({
      id: userId,
      email,
      role: role as 'user' | 'professional' | 'admin',
      isVerifiedProfessional: false, // Professionals still need verification
    });

    const response = NextResponse.json({
      success: true,
      user: { id: userId, name, email, role },
    });

    response.headers.set('Set-Cookie', setAuthCookie(token));

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status: 500 }
    );
  }
}

