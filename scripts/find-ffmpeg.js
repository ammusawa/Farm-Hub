/**
 * Script to find FFmpeg installation on Windows
 * Run: node scripts/find-ffmpeg.js
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const { existsSync, readFileSync } = require('fs');
const path = require('path');

const execAsync = promisify(exec);

// Load .env file if it exists
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
}

async function findFFmpeg() {
  console.log('🔍 Searching for FFmpeg...\n');
  
  // Load .env file first
  loadEnvFile();

  // 1. Check environment variable
  const envPath = process.env.FFMPEG_PATH || process.env.FFMPEG_BIN;
  if (envPath && existsSync(envPath)) {
    console.log(`✅ Found FFmpeg via environment variable: ${envPath}`);
    return envPath;
  }

  // 2. Try common Windows paths and project root
  const commonPaths = [
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
    path.join(process.cwd(), 'ffmpeg.exe'),
    path.join(process.cwd(), 'bin', 'ffmpeg.exe'),
    path.join(process.cwd(), 'ffmpeg-8.0-essentials_build', 'bin', 'ffmpeg.exe'),
  ];

  console.log('Checking common installation paths...');
  for (const ffmpegPath of commonPaths) {
    if (existsSync(ffmpegPath)) {
      console.log(`✅ Found FFmpeg at: ${ffmpegPath}`);
      return ffmpegPath;
    }
  }

  // 3. Try 'where' command (Windows)
  if (process.platform === 'win32') {
    try {
      console.log('Trying "where ffmpeg" command...');
      const { stdout } = await execAsync('where ffmpeg');
      const ffmpegPath = stdout.trim().split('\n')[0];
      if (ffmpegPath && existsSync(ffmpegPath)) {
        console.log(`✅ Found FFmpeg via 'where' command: ${ffmpegPath}`);
        return ffmpegPath;
      }
    } catch (error) {
      console.log('❌ "where ffmpeg" command failed');
    }
  }

  // 4. Try direct command
  try {
    console.log('Trying "ffmpeg -version" command...');
    await execAsync('ffmpeg -version');
    console.log('✅ FFmpeg is in PATH');
    return 'ffmpeg';
  } catch (error) {
    console.log('❌ FFmpeg not found in PATH');
  }

  console.log('\n❌ FFmpeg not found!\n');
  console.log('To fix this, you can:');
  console.log('1. Add FFmpeg to your system PATH');
  console.log('2. Set FFMPEG_PATH in your .env file:');
  console.log('   FFMPEG_PATH=C:\\path\\to\\ffmpeg.exe');
  console.log('3. Place ffmpeg.exe in your project root directory');
  console.log('\nTo find where FFmpeg is installed, run in CMD:');
  console.log('   where ffmpeg');
  
  return null;
}

findFFmpeg().then((path) => {
  if (path) {
    console.log(`\n💡 Add this to your .env file:`);
    console.log(`FFMPEG_PATH=${path}`);
  }
  process.exit(path ? 0 : 1);
});

