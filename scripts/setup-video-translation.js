/**
 * Setup script for video translation feature
 * This script helps verify the setup and provides helpful information
 */

const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');

async function checkFFmpeg() {
  try {
    await execAsync('ffmpeg -version');
    console.log('✅ FFmpeg is installed');
    return true;
  } catch (error) {
    console.log('❌ FFmpeg is NOT installed');
    console.log('   Please install FFmpeg: https://ffmpeg.org/download.html');
    return false;
  }
}

async function checkDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmhub',
    });

    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'content_translations'"
    );

    if (tables.length > 0) {
      console.log('✅ content_translations table exists');
      await connection.end();
      return true;
    } else {
      console.log('❌ content_translations table does NOT exist');
      console.log('   Please run: SOURCE lib/db-schema-video-translations.sql;');
      await connection.end();
      return false;
    }
  } catch (error) {
    console.log('❌ Database connection failed');
    console.log('   Error:', error.message);
    return false;
  }
}

async function checkEnvVars() {
  const required = ['OPENAI_API_KEY', 'GOOGLE_TTS_API_KEY'];
  const optional = ['NEXT_PUBLIC_BASE_URL'];
  
  console.log('\n📋 Environment Variables:');
  
  let allSet = true;
  for (const key of required) {
    if (process.env[key]) {
      console.log(`✅ ${key} is set`);
    } else {
      console.log(`⚠️  ${key} is NOT set (optional but recommended)`);
      allSet = false;
    }
  }
  
  for (const key of optional) {
    if (process.env[key]) {
      console.log(`✅ ${key} is set`);
    } else {
      console.log(`ℹ️  ${key} is not set (will use default: http://localhost:3000)`);
    }
  }
  
  return allSet;
}

async function checkUploadsDir() {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  try {
    await fs.access(uploadsDir);
    console.log('✅ Uploads directory exists');
    return true;
  } catch {
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      console.log('✅ Created uploads directory');
      return true;
    } catch (error) {
      console.log('❌ Failed to create uploads directory');
      console.log('   Error:', error.message);
      return false;
    }
  }
}

async function main() {
  console.log('🚀 Video Translation Setup Check\n');
  console.log('='.repeat(50));
  
  const results = {
    ffmpeg: await checkFFmpeg(),
    database: await checkDatabase(),
    envVars: await checkEnvVars(),
    uploadsDir: await checkUploadsDir(),
  };
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Summary:');
  
  const allGood = Object.values(results).every(v => v);
  
  if (allGood) {
    console.log('✅ All checks passed! Video translation is ready to use.');
  } else {
    console.log('⚠️  Some checks failed. Please fix the issues above.');
    console.log('\n📖 See SETUP_VIDEO_TRANSLATION.md for detailed setup instructions.');
  }
  
  console.log('\n');
}

main().catch(console.error);

