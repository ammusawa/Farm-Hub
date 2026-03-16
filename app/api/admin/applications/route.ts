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

    const [rows] = await pool.execute(
      `SELECT pa.*, u.name, u.email
       FROM professional_applications pa
       LEFT JOIN users u ON pa.userId = u.id
       ORDER BY pa.createdAt DESC`
    );

    return NextResponse.json({ applications: rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { applicationId, status, adminNotes } = await request.json();

    if (!applicationId || !status) {
      return NextResponse.json(
        { error: 'Application ID and status are required' },
        { status: 400 }
      );
    }

    // Update application
    await pool.execute(
      `UPDATE professional_applications
       SET status = ?, adminNotes = ?
       WHERE id = ?`,
      [status, adminNotes || null, applicationId]
    );

    // If approved, update user
    if (status === 'approved') {
      const [app] = await pool.execute(
        'SELECT userId FROM professional_applications WHERE id = ?',
        [applicationId]
      ) as any[];

      if (app && app.length > 0) {
        await pool.execute(
          `UPDATE users
           SET role = 'professional', isVerifiedProfessional = TRUE
           WHERE id = ?`,
          [app[0].userId]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update application' },
      { status: 500 }
    );
  }
}

