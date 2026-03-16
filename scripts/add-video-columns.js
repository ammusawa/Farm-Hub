/**
 * Add video columns to existing content table
 * 
 * Usage: node scripts/add-video-columns.js
 * 
 * Make sure to set your DATABASE_* environment variables first
 */

const mysql = require('mysql2/promise');

async function addVideoColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'agriconsult_hub',
    multipleStatements: true,
  });

  try {
    console.log('🔧 Adding video columns to content table...\n');

    // Check which columns already exist
    const [existingColumns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'content'`,
      [process.env.DATABASE_NAME || 'agriconsult_hub']
    );

    const existingColumnNames = existingColumns.map(c => c.COLUMN_NAME);
    console.log('Existing columns:', existingColumnNames.join(', '));
    console.log('');

    // Add video columns if they don't exist
    const videoColumns = [
      {
        name: 'videoFile',
        definition: 'VARCHAR(500) NULL'
      },
      {
        name: 'videoThumbnail',
        definition: 'VARCHAR(500) NULL'
      },
      {
        name: 'videoDuration',
        definition: 'INT NULL COMMENT \'Duration in seconds\''
      },
      {
        name: 'videoSize',
        definition: 'BIGINT NULL COMMENT \'File size in bytes\''
      },
      {
        name: 'videoFormat',
        definition: 'VARCHAR(50) NULL COMMENT \'Video format (mp4, webm, etc.)\''
      },
      {
        name: 'videoResolution',
        definition: 'VARCHAR(20) NULL COMMENT \'Video resolution (e.g., 1920x1080)\''
      }
    ];

    for (const column of videoColumns) {
      if (existingColumnNames.includes(column.name)) {
        console.log(`✅ Column '${column.name}' already exists, skipping...`);
      } else {
        try {
          await connection.execute(
            `ALTER TABLE content ADD COLUMN ${column.name} ${column.definition}`
          );
          console.log(`✅ Added column '${column.name}'`);
        } catch (error) {
          console.error(`❌ Failed to add column '${column.name}':`, error.message);
        }
      }
    }

    console.log('\n✅ Video columns setup completed!\n');
    console.log('💡 You can now upload videos and they will be stored correctly.\n');

  } catch (error) {
    console.error('❌ Error adding video columns:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

addVideoColumns();

