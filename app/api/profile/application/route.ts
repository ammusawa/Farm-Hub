import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's professional application if exists
    // Try to select all columns first, fall back to basic columns if new ones don't exist
    let applications: any[];
    
    try {
      // Try full query with all columns
      [applications] = await pool.execute(
        `SELECT id, credentialsFile, status, adminNotes, experience, qualifications, 
                specialization, yearsOfExperience, location, createdAt, updatedAt
         FROM professional_applications
         WHERE userId = ?
         ORDER BY createdAt DESC
         LIMIT 1`,
        [user.id]
      ) as any[];
    } catch (err: any) {
      // If query fails (likely because new columns don't exist), try basic query
      if (err.code === 'ER_BAD_FIELD_ERROR' || err.message?.includes('Unknown column')) {
        console.warn('New columns not found, using basic schema');
        [applications] = await pool.execute(
          `SELECT id, credentialsFile, status, adminNotes, createdAt, updatedAt
           FROM professional_applications
           WHERE userId = ?
           ORDER BY createdAt DESC
           LIMIT 1`,
          [user.id]
        ) as any[];
        
        // Add null values for missing columns
        if (applications && applications.length > 0) {
          applications[0].experience = null;
          applications[0].qualifications = null;
          applications[0].specialization = null;
          applications[0].yearsOfExperience = null;
          applications[0].location = null;
        }
      } else {
        // Re-throw if it's a different error
        throw err;
      }
    }

    return NextResponse.json({
      application: applications && applications.length > 0 ? applications[0] : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch application' },
      { status: 500 }
    );
  }
}

