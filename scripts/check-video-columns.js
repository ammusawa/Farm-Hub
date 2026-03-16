/**
 * Check if video columns exist in the content table
 * 
 * Usage: node scripts/check-video-columns.js
 */

const mysql = require('mysql2/promise');

async function checkVideoColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'agriconsult_hub',
  });

  try {
    console.log('Checking content table columns...\n');

    // Get all columns from content table
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'content'
       ORDER BY ORDINAL_POSITION`,
      [process.env.DATABASE_NAME || 'agriconsult_hub']
    );

    console.log('Content table columns:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    columns.forEach(col => {
      console.log(`  ${col.COLUMN_NAME.padEnd(25)} ${col.DATA_TYPE.padEnd(15)} ${col.IS_NULLABLE}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check for video columns
    const columnNames = columns.map(c => c.COLUMN_NAME);
    const requiredVideoColumns = ['videoFile', 'videoThumbnail', 'videoDuration', 'videoSize', 'videoFormat', 'videoResolution'];
    
    console.log('Video columns status:');
    const missingColumns = [];
    requiredVideoColumns.forEach(col => {
      if (columnNames.includes(col)) {
        console.log(`  ✅ ${col} - exists`);
      } else {
        console.log(`  ❌ ${col} - MISSING`);
        missingColumns.push(col);
      }
    });

    if (missingColumns.length > 0) {
      console.log('\n⚠️  Missing video columns detected!');
      console.log('   Run "npm run setup-db" to add the missing columns.\n');
    } else {
      console.log('\n✅ All video columns exist!\n');
    }

    // Check for video content without videoFile
    const [videosWithoutFile] = await connection.execute(
      `SELECT id, title, contentType, videoFile 
       FROM content 
       WHERE contentType = 'video' AND (videoFile IS NULL OR videoFile = '')`
    );

    if (videosWithoutFile.length > 0) {
      console.log(`⚠️  Found ${videosWithoutFile.length} video content(s) without videoFile:\n`);
      videosWithoutFile.forEach(v => {
        console.log(`   ID: ${v.id}, Title: ${v.title}, VideoFile: ${v.videoFile || 'NULL'}`);
      });
      console.log('\n   These videos need to be re-uploaded with the video file.\n');
    }

  } catch (error) {
    console.error('❌ Error checking columns:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

checkVideoColumns();

