import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    if (!role || !['admin', 'professional', 'user'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role parameter' },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute(
      `SELECT id, name, email, role, isVerifiedProfessional, createdAt
       FROM users
       WHERE role = ?
       ORDER BY createdAt DESC`,
      [role]
    );

    return NextResponse.json({ users: rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

