/**
 * Database Seeding Script
 * 
 * This script seeds the database with admin and test users
 * It generates password hashes automatically
 * 
 * Usage: node scripts/seed-database.js
 * 
 * Make sure to set your DATABASE_* environment variables first
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function seedDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'agriconsult_hub',
  });

  try {
    console.log('🌱 Starting database seeding...\n');

    // Generate password hashes
    const adminPassword = 'Admin123!';
    const testPassword = 'Test123!';
    
    console.log('Generating password hashes...');
    const adminHash = await bcrypt.hash(adminPassword, 10);
    const testHash = await bcrypt.hash(testPassword, 10);

    // Admin users
    console.log('Creating admin users...');
    await connection.execute(
      `INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) 
       VALUES (?, ?, ?, 'admin', FALSE, NOW())
       ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), role=VALUES(role), isVerifiedProfessional=FALSE`,
      ['Admin User', 'admin@agriconsult.com', adminHash]
    );
    
    await connection.execute(
      `INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) 
       VALUES (?, ?, ?, 'admin', FALSE, NOW())
       ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), role=VALUES(role), isVerifiedProfessional=FALSE`,
      ['Super Admin', 'superadmin@agriconsult.com', adminHash]
    );

    // Regular users
    console.log('Creating test users...');
    await connection.execute(
      `INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) 
       VALUES (?, ?, ?, 'user', FALSE, NOW())
       ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password)`,
      ['John Farmer', 'farmer1@example.com', testHash]
    );
    
    await connection.execute(
      `INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) 
       VALUES (?, ?, ?, 'user', FALSE, NOW())
       ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password)`,
      ['Mary Grower', 'farmer2@example.com', testHash]
    );

    // Professional users (not verified)
    console.log('Creating professional users...');
    await connection.execute(
      `INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) 
       VALUES (?, ?, ?, 'professional', FALSE, NOW())
       ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), role=VALUES(role)`,
      ['Dr. Agriculture Expert', 'professional1@example.com', testHash]
    );
    
    await connection.execute(
      `INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) 
       VALUES (?, ?, ?, 'professional', FALSE, NOW())
       ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), role=VALUES(role)`,
      ['Master Farmer', 'professional2@example.com', testHash]
    );

    // Verified professional user
    console.log('Creating verified professional user...');
    await connection.execute(
      `INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) 
       VALUES (?, ?, ?, 'professional', TRUE, NOW())
       ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), role=VALUES(role), isVerifiedProfessional=VALUES(isVerifiedProfessional)`,
      ['Verified Expert', 'verified@example.com', testHash]
    );

    // Get user IDs for professional applications
    console.log('Creating professional applications...');
    const [professional1] = await connection.execute(
      "SELECT id FROM users WHERE email = 'professional1@example.com'"
    );
    const [professional2] = await connection.execute(
      "SELECT id FROM users WHERE email = 'professional2@example.com'"
    );
    const [farmer1] = await connection.execute(
      "SELECT id FROM users WHERE email = 'farmer1@example.com'"
    );
    const [farmer2] = await connection.execute(
      "SELECT id FROM users WHERE email = 'farmer2@example.com'"
    );

    // Professional Application 1: Pending
    if (professional1.length > 0) {
      await connection.execute(
        `INSERT INTO professional_applications 
         (userId, credentialsFile, experience, qualifications, specialization, yearsOfExperience, location, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
         ON DUPLICATE KEY UPDATE 
         experience=VALUES(experience), 
         qualifications=VALUES(qualifications),
         specialization=VALUES(specialization),
         yearsOfExperience=VALUES(yearsOfExperience),
         location=VALUES(location),
         status=VALUES(status)`,
        [
          professional1[0].id,
          'https://example.com/credentials/certificate1.pdf',
          'Over 10 years of experience in sustainable farming practices, specializing in organic crop production and soil management. Worked with smallholder farmers across Northern Nigeria.',
          'B.Sc. Agricultural Science (Ahmadu Bello University), Certified Organic Farming Practitioner, Extension Services Certificate',
          'Organic Farming & Soil Management',
          12,
          'Kaduna, Nigeria'
        ]
      );
    }

    // Professional Application 2: Pending
    if (professional2.length > 0) {
      await connection.execute(
        `INSERT INTO professional_applications 
         (userId, credentialsFile, experience, qualifications, specialization, yearsOfExperience, location, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
         ON DUPLICATE KEY UPDATE 
         experience=VALUES(experience), 
         qualifications=VALUES(qualifications),
         specialization=VALUES(specialization),
         yearsOfExperience=VALUES(yearsOfExperience),
         location=VALUES(location),
         status=VALUES(status)`,
        [
          professional2[0].id,
          'https://example.com/credentials/certificate2.pdf',
          '15 years of hands-on farming experience with focus on crop rotation, pest management, and irrigation systems. Successfully managed 50+ hectare farms.',
          'Diploma in Agricultural Extension, Master Farmer Certification, Irrigation Systems Specialist',
          'Crop Management & Irrigation',
          15,
          'Kano, Nigeria'
        ]
      );
    }

    // Professional Application 3: Approved (from farmer1)
    if (farmer1.length > 0) {
      await connection.execute(
        `INSERT INTO professional_applications 
         (userId, credentialsFile, experience, qualifications, specialization, yearsOfExperience, location, status, adminNotes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, NOW())
         ON DUPLICATE KEY UPDATE 
         experience=VALUES(experience), 
         qualifications=VALUES(qualifications),
         specialization=VALUES(specialization),
         yearsOfExperience=VALUES(yearsOfExperience),
         location=VALUES(location),
         status=VALUES(status),
         adminNotes=VALUES(adminNotes)`,
        [
          farmer1[0].id,
          'https://example.com/credentials/certificate3.pdf',
          '8 years of experience in poultry farming and livestock management. Expert in disease prevention and feed optimization.',
          'B.Sc. Animal Science (University of Ibadan), Poultry Management Certificate, Livestock Health Certification',
          'Poultry & Livestock Management',
          8,
          'Lagos, Nigeria',
          'Application approved. Strong credentials and relevant experience verified.'
        ]
      );
      
      // Update user to verified professional
      await connection.execute(
        `UPDATE users SET isVerifiedProfessional = TRUE, role = 'professional' WHERE id = ?`,
        [farmer1[0].id]
      );
    }

    // Professional Application 4: Rejected (from farmer2)
    if (farmer2.length > 0) {
      await connection.execute(
        `INSERT INTO professional_applications 
         (userId, credentialsFile, experience, qualifications, specialization, yearsOfExperience, location, status, adminNotes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'rejected', ?, NOW())
         ON DUPLICATE KEY UPDATE 
         experience=VALUES(experience), 
         qualifications=VALUES(qualifications),
         specialization=VALUES(specialization),
         yearsOfExperience=VALUES(yearsOfExperience),
         location=VALUES(location),
         status=VALUES(status),
         adminNotes=VALUES(adminNotes)`,
        [
          farmer2[0].id,
          'https://example.com/credentials/certificate4.pdf',
          '3 years of small-scale farming experience. Growing vegetables and fruits in backyard garden.',
          'High School Certificate, Basic Farming Workshop',
          'Small-scale Vegetable Farming',
          3,
          'Abuja, Nigeria',
          'Application rejected. Insufficient experience and qualifications for professional status. Applicant encouraged to gain more experience and reapply.'
        ]
      );
    }

    // Display created users
    console.log('\n✅ Database seeded successfully!\n');
    console.log('📋 Created Users:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const [admins] = await connection.execute(
      "SELECT name, email, role FROM users WHERE role = 'admin'"
    );
    console.log('\n👑 Admin Users:');
    admins.forEach(user => {
      console.log(`   • ${user.name} (${user.email})`);
      console.log(`     Password: ${adminPassword}`);
    });

    const [professionals] = await connection.execute(
      "SELECT name, email, role, isVerifiedProfessional FROM users WHERE role = 'professional'"
    );
    console.log('\n🌾 Professional Users:');
    professionals.forEach(user => {
      const status = user.isVerifiedProfessional ? '✓ Verified' : '⏳ Not Verified';
      console.log(`   • ${user.name} (${user.email}) - ${status}`);
      console.log(`     Password: ${testPassword}`);
    });

    const [regularUsers] = await connection.execute(
      "SELECT name, email FROM users WHERE role = 'user'"
    );
    console.log('\n👤 Regular Users:');
    regularUsers.forEach(user => {
      console.log(`   • ${user.name} (${user.email})`);
      console.log(`     Password: ${testPassword}`);
    });

    // Display professional applications
    const [applications] = await connection.execute(
      `SELECT pa.id, u.name, u.email, pa.status, pa.specialization, pa.yearsOfExperience, pa.location
       FROM professional_applications pa
       JOIN users u ON pa.userId = u.id
       ORDER BY pa.createdAt DESC`
    );
    
    if (applications.length > 0) {
      console.log('\n📋 Professional Applications:');
      applications.forEach(app => {
        const statusIcon = app.status === 'approved' ? '✅' : app.status === 'rejected' ? '❌' : '⏳';
        console.log(`   ${statusIcon} ${app.name} (${app.email})`);
        console.log(`     Status: ${app.status.toUpperCase()}`);
        console.log(`     Specialization: ${app.specialization || 'N/A'}`);
        console.log(`     Experience: ${app.yearsOfExperience || 'N/A'} years`);
        console.log(`     Location: ${app.location || 'N/A'}`);
      });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 You can now login with any of these accounts!');
    console.log('   Admin: admin@agriconsult.com / Admin123!');
    console.log('   Test User: farmer1@example.com / Test123!');
    console.log('   Verified Professional: verified@example.com / Test123!');
    console.log('\n📌 Admin Dashboard:');
    console.log('   Visit /admin/applications to review professional applications');
    console.log('   You will see 2 pending, 1 approved, and 1 rejected application');
    console.log('\n');

  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seedDatabase();

