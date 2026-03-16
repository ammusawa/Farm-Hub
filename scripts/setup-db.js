/**
 * Database Setup Script
 * Run this to initialize the database schema
 * 
 * Usage: node scripts/setup-db.js
 * 
 * Make sure to set your DATABASE_* environment variables first
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function checkAndCreateTables(connection) {
  const dbName = process.env.DATABASE_NAME || 'agriconsult_hub';
  
  // List of all required tables
  const requiredTables = [
    'users',
    'professional_applications',
    'content',
    'ratings',
    'comments',
    'translations',
    'content_likes',
    'subscriptions',
    'content_translations',
    'professional_files',
    'video_transcripts'
  ];

  // Get existing tables
  const [existingTables] = await connection.execute(
    `SELECT TABLE_NAME 
     FROM INFORMATION_SCHEMA.TABLES 
     WHERE TABLE_SCHEMA = ?`,
    [dbName]
  );

  const existingTableNames = existingTables.map(t => t.TABLE_NAME);
  const missingTables = requiredTables.filter(t => !existingTableNames.includes(t));

  if (missingTables.length > 0) {
    console.log(`\n⚠️  Missing tables detected: ${missingTables.join(', ')}`);
    console.log('   These should be created by the schema file. Re-running schema...');
    return false; // Indicate tables are missing
  }

  return true; // All tables exist
}

async function addMissingColumns(connection) {
  const dbName = process.env.DATABASE_NAME || 'agriconsult_hub';
  let totalAdded = 0;

  try {
    // ===== CONTENT TABLE =====
    const [existingContentColumns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'content'`,
      [dbName]
    );
    const existingContentColumnNames = existingContentColumns.map(c => c.COLUMN_NAME);

    const contentColumns = [
      { name: 'videoFile', definition: 'VARCHAR(500) NULL' },
      { name: 'videoThumbnail', definition: 'VARCHAR(500) NULL' },
      { name: 'videoDuration', definition: 'INT NULL COMMENT \'Duration in seconds\'' },
      { name: 'videoSize', definition: 'BIGINT NULL COMMENT \'File size in bytes\'' },
      { name: 'videoFormat', definition: 'VARCHAR(50) NULL COMMENT \'Video format (mp4, webm, etc.)\'' },
      { name: 'videoResolution', definition: 'VARCHAR(20) NULL COMMENT \'Video resolution (e.g., 1920x1080)\'' }
    ];

    for (const column of contentColumns) {
      if (!existingContentColumnNames.includes(column.name)) {
        try {
          await connection.execute(
            `ALTER TABLE content ADD COLUMN ${column.name} ${column.definition}`
          );
          console.log(`  ✅ Added column 'content.${column.name}'`);
          totalAdded++;
        } catch (error) {
          console.warn(`  ⚠️  Could not add column 'content.${column.name}':`, error.message);
        }
      }
    }

    // ===== PROFESSIONAL_APPLICATIONS TABLE =====
    const [existingAppColumns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'professional_applications'`,
      [dbName]
    );
    const existingAppColumnNames = existingAppColumns.map(c => c.COLUMN_NAME);

    const appColumns = [
      { name: 'experience', definition: 'TEXT' },
      { name: 'qualifications', definition: 'TEXT' },
      { name: 'specialization', definition: 'VARCHAR(255)' },
      { name: 'yearsOfExperience', definition: 'INT' },
      { name: 'location', definition: 'VARCHAR(255)' }
    ];

    for (const column of appColumns) {
      if (!existingAppColumnNames.includes(column.name)) {
        try {
          await connection.execute(
            `ALTER TABLE professional_applications ADD COLUMN ${column.name} ${column.definition}`
          );
          console.log(`  ✅ Added column 'professional_applications.${column.name}'`);
          totalAdded++;
        } catch (error) {
          console.warn(`  ⚠️  Could not add column 'professional_applications.${column.name}':`, error.message);
        }
      }
    }

    // ===== CHECK FOR MISSING TABLES =====
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('video_transcripts', 'content_translations', 'professional_files', 'content_likes', 'subscriptions')`,
      [dbName]
    );
    const existingTableNames = tables.map(t => t.TABLE_NAME);

    // Create video_transcripts if missing
    if (!existingTableNames.includes('video_transcripts')) {
      try {
        await connection.execute(
          `CREATE TABLE IF NOT EXISTS video_transcripts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            contentId INT NOT NULL,
            language VARCHAR(10) NOT NULL,
            transcript TEXT,
            subtitles JSON,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_content_language (contentId, language),
            FOREIGN KEY (contentId) REFERENCES content(id) ON DELETE CASCADE,
            INDEX idx_contentId (contentId),
            INDEX idx_language (language)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        );
        console.log(`  ✅ Created table 'video_transcripts'`);
        totalAdded++;
      } catch (error) {
        console.warn('  ⚠️  Could not create video_transcripts table:', error.message);
      }
    }

    // Create content_translations if missing
    if (!existingTableNames.includes('content_translations')) {
      try {
        await connection.execute(
          `CREATE TABLE IF NOT EXISTS content_translations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            contentId INT NOT NULL COMMENT 'Reference to content table',
            sourceLanguage VARCHAR(10) NOT NULL COMMENT 'Original video language',
            targetLanguage VARCHAR(10) NOT NULL COMMENT 'Translated video language',
            translatedVideoFile VARCHAR(500) NULL COMMENT 'Path to translated video file',
            status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_content_target (contentId, targetLanguage),
            FOREIGN KEY (contentId) REFERENCES content(id) ON DELETE CASCADE,
            INDEX idx_contentId (contentId),
            INDEX idx_targetLanguage (targetLanguage),
            INDEX idx_status (status)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        );
        console.log(`  ✅ Created table 'content_translations'`);
        totalAdded++;
      } catch (error) {
        console.warn('  ⚠️  Could not create content_translations table:', error.message);
      }
    }

    // Create professional_files if missing
    if (!existingTableNames.includes('professional_files')) {
      try {
        await connection.execute(
          `CREATE TABLE IF NOT EXISTS professional_files (
            id INT AUTO_INCREMENT PRIMARY KEY,
            applicationId INT NOT NULL,
            fileName VARCHAR(255) NOT NULL,
            filePath VARCHAR(500) NOT NULL,
            fileType VARCHAR(100),
            fileSize INT,
            uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (applicationId) REFERENCES professional_applications(id) ON DELETE CASCADE,
            INDEX idx_applicationId (applicationId)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        );
        console.log(`  ✅ Created table 'professional_files'`);
        totalAdded++;
      } catch (error) {
        console.warn('  ⚠️  Could not create professional_files table:', error.message);
      }
    }

    // Create content_likes if missing
    if (!existingTableNames.includes('content_likes')) {
      try {
        await connection.execute(
          `CREATE TABLE IF NOT EXISTS content_likes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            userId INT NOT NULL,
            contentId INT NOT NULL,
            type ENUM('like', 'dislike') NOT NULL,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_content (userId, contentId),
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (contentId) REFERENCES content(id) ON DELETE CASCADE,
            INDEX idx_contentId (contentId),
            INDEX idx_userId (userId),
            INDEX idx_type (type)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        );
        console.log(`  ✅ Created table 'content_likes'`);
        totalAdded++;
      } catch (error) {
        console.warn('  ⚠️  Could not create content_likes table:', error.message);
      }
    }

    // Create subscriptions if missing
    if (!existingTableNames.includes('subscriptions')) {
      try {
        await connection.execute(
          `CREATE TABLE IF NOT EXISTS subscriptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            subscriberId INT NOT NULL COMMENT 'User who is subscribing',
            professionalId INT NOT NULL COMMENT 'Professional being subscribed to',
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_subscription (subscriberId, professionalId),
            FOREIGN KEY (subscriberId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (professionalId) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_subscriber (subscriberId),
            INDEX idx_professional (professionalId)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        );
        console.log(`  ✅ Created table 'subscriptions'`);
        totalAdded++;
      } catch (error) {
        console.warn('  ⚠️  Could not create subscriptions table:', error.message);
      }
    }

    if (totalAdded > 0) {
      console.log(`\n  📝 Added ${totalAdded} missing item(s) to database`);
    } else {
      console.log(`\n  ✅ All tables and columns are up to date`);
    }

    return { totalAdded };
  } catch (error) {
    console.warn('  ⚠️  Warning: Could not add missing columns/tables:', error.message);
    return { totalAdded: 0 };
  }
}

async function setupDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    console.log('📖 Reading schema file...');
    const schemaPath = path.join(__dirname, '../lib/db-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔧 Executing schema...');
    await connection.query(schema);

    console.log('\n🔍 Verifying all tables exist...');
    const allTablesExist = await checkAndCreateTables(connection);
    
    if (!allTablesExist) {
      console.log('   Re-running schema to create missing tables...');
      await connection.query(schema);
    }

    console.log('\n🔍 Checking for missing columns and tables...');
    await addMissingColumns(connection);

    console.log('\n✅ Database setup completed successfully!');
    console.log('\n📊 Database Summary:');
    console.log('   - Users & Authentication');
    console.log('   - Professional Applications');
    console.log('   - Content (Articles, Videos, Tips)');
    console.log('   - Ratings & Comments');
    console.log('   - Content Likes/Dislikes');
    console.log('   - Subscriptions');
    console.log('   - Video Transcripts');
    console.log('   - Content Translations');
    console.log('   - Professional Files');
    console.log('   - UI Translations');
    console.log('\nNext steps:');
    console.log('1. Create an admin user manually or through the registration page');
    console.log('2. Update the user role to "admin" in the database if needed');
    console.log('3. Start the development server: npm run dev');
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

setupDatabase();

