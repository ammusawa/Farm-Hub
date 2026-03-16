import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { 
      credentialsFile, 
      files, 
      experience, 
      qualifications, 
      specialization, 
      yearsOfExperience, 
      location 
    } = await request.json();

    if (!credentialsFile && (!files || files.length === 0)) {
      return NextResponse.json(
        { error: 'At least one credentials file is required' },
        { status: 400 }
      );
    }

    // Check if application already exists
    const [existing] = await pool.execute(
      'SELECT id, status FROM professional_applications WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      [user.id]
    ) as any[];

    let applicationId: number;

    if (existing && existing.length > 0) {
      const existingApp = existing[0];
      
      // If application is pending or approved, don't allow resubmission
      if (existingApp.status === 'pending' || existingApp.status === 'approved') {
        return NextResponse.json(
          { error: 'Application already submitted' },
          { status: 400 }
        );
      }
      
      // If rejected, update the existing application
      if (existingApp.status === 'rejected') {
        await pool.execute(
          `UPDATE professional_applications
           SET credentialsFile = ?, 
               experience = ?, 
               qualifications = ?, 
               specialization = ?, 
               yearsOfExperience = ?, 
               location = ?,
               status = 'pending', 
               adminNotes = NULL, 
               updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            credentialsFile || null,
            experience || null,
            qualifications || null,
            specialization || null,
            yearsOfExperience || null,
            location || null,
            existingApp.id
          ]
        );
        applicationId = existingApp.id;

        // Delete old files and insert new ones
        await pool.execute(
          'DELETE FROM professional_files WHERE applicationId = ?',
          [applicationId]
        );
      } else {
        applicationId = existingApp.id;
      }
    } else {
      // Create new application
      const [result] = await pool.execute(
        `INSERT INTO professional_applications 
         (userId, credentialsFile, experience, qualifications, specialization, yearsOfExperience, location, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          user.id,
          credentialsFile || null,
          experience || null,
          qualifications || null,
          specialization || null,
          yearsOfExperience || null,
          location || null
        ]
      ) as any;
      applicationId = result.insertId;
    }

    // Insert files if provided
    if (files && files.length > 0) {
      for (const file of files) {
        await pool.execute(
          `INSERT INTO professional_files (applicationId, fileName, filePath, fileType, fileSize)
           VALUES (?, ?, ?, ?, ?)`,
          [
            applicationId,
            file.fileName,
            file.filePath,
            file.fileType,
            file.fileSize
          ]
        );
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: existing && existing.length > 0 ? 'Application resubmitted' : 'Application submitted',
      applicationId 
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to submit application' },
      { status: 500 }
    );
  }
}

