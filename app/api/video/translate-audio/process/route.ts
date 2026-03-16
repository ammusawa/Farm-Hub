import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { translateText } from '@/lib/translate';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

// Helper function to find FFmpeg executable
async function findFFmpeg(): Promise<string> {
  // 1. Check environment variable first
  const envPath = process.env.FFMPEG_PATH || process.env.FFMPEG_BIN;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  // 2. Try common Windows installation paths
  const commonPaths = [
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
    path.join(process.cwd(), 'ffmpeg.exe'),
    path.join(process.cwd(), 'bin', 'ffmpeg.exe'),
  ];

  for (const ffmpegPath of commonPaths) {
    if (existsSync(ffmpegPath)) {
      console.log(`Found FFmpeg at: ${ffmpegPath}`);
      return ffmpegPath;
    }
  }

  // 3. Try to find it in PATH
  try {
    await execAsync('ffmpeg -version');
    return 'ffmpeg'; // Found in PATH
  } catch (error) {
    // Not in PATH, continue to error
  }

  // 4. Try with full path from where command (Windows)
  if (process.platform === 'win32') {
    try {
      // Use 'where' command to find FFmpeg in PATH
      // Note: Node.js might have different PATH than CMD, so this might fail
      const { stdout } = await execAsync('where ffmpeg', { 
        shell: true,
        env: process.env
      });
      const paths = stdout.trim().split(/\r?\n/).filter(p => p.trim() && !p.includes('INFO:'));
      for (const ffmpegPath of paths) {
        const trimmedPath = ffmpegPath.trim();
        if (trimmedPath && existsSync(trimmedPath)) {
          console.log(`Found FFmpeg via 'where' command: ${trimmedPath}`);
          return trimmedPath;
        }
      }
    } catch (error) {
      // 'where' command failed - FFmpeg not in PATH for Node.js
      // This is common - Node.js doesn't always inherit PATH correctly
    }
  }

  // Provide helpful error message with instructions
  throw new Error(
    'FFmpeg not found. Node.js cannot access FFmpeg from your PATH.\n\n' +
    'SOLUTION: Set FFMPEG_PATH in your .env file\n' +
    '1. Find your FFmpeg path by running in CMD: where ffmpeg\n' +
    '2. Add to .env file: FFMPEG_PATH=C:\\path\\to\\ffmpeg.exe\n' +
    '3. Restart your dev server\n\n' +
    'Alternative: Place ffmpeg.exe in your project root directory'
  );
}

// This endpoint processes video translation
// It should be called by a background job processor
export async function POST(request: NextRequest) {
  try {
    const { contentId, sourceLanguage, targetLanguage, videoFilePath } = await request.json();

    if (!contentId || !sourceLanguage || !targetLanguage || !videoFilePath) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Update status to processing
    await pool.execute(
      `INSERT INTO content_translations (contentId, sourceLanguage, targetLanguage, status)
       VALUES (?, ?, ?, 'processing')
       ON DUPLICATE KEY UPDATE status = 'processing', updatedAt = CURRENT_TIMESTAMP`,
      [contentId, sourceLanguage, targetLanguage]
    );

    try {
      // Validate required services before starting
      console.log('Starting video translation process:', {
        contentId,
        sourceLanguage,
        targetLanguage,
        videoFilePath,
      });

      // Check if FFmpeg is available (will be checked in functions, but log early)
      try {
        const ffmpegPath = await findFFmpeg();
        console.log(`✓ FFmpeg is available at: ${ffmpegPath}`);
      } catch (ffmpegError: any) {
        console.error('✗ FFmpeg is not available:', ffmpegError.message);
        throw new Error(ffmpegError.message || 'FFmpeg is not installed or not in PATH. Please install FFmpeg to enable video translation.');
      }

      // Check if TTS service is configured
      // gtts library is installed and works without API keys (free)
      try {
        require('gtts');
        console.log('✓ TTS service available (gtts - free, no API key required)');
      } catch (gttsError) {
        const hasGoogleTTS = !!(process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_CLOUD_API_KEY);
        const hasAWSPolly = !!(process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID);
        if (!hasGoogleTTS && !hasAWSPolly) {
          console.warn('⚠ No TTS service available. Please install gtts: npm install gtts');
        } else {
          console.log('✓ TTS service configured (API key)');
        }
      }

      // Step 1: Extract audio from video (would use FFmpeg in production)
      // Step 2: Transcribe audio using speech-to-text (Whisper, Google Speech-to-Text, etc.)
      // Step 3: Translate transcript
      // Step 4: Generate new audio using text-to-speech
      // Step 5: Merge new audio with original video
      // Step 6: Save translated video

      // For MVP, we'll use a simplified approach
      // In production, integrate with:
      // - OpenAI Whisper API for speech-to-text
      // - Google Cloud Translation API
      // - Google Cloud Text-to-Speech or AWS Polly
      // - FFmpeg for video processing

      const translatedVideoPath = await processVideoTranslation(
        videoFilePath,
        contentId,
        sourceLanguage,
        targetLanguage
      );

      console.log('✓ Video translation completed successfully:', translatedVideoPath);

      // Update database with translated video path
      await pool.execute(
        `UPDATE content_translations 
         SET translatedVideoFile = ?, status = 'completed', updatedAt = CURRENT_TIMESTAMP
         WHERE contentId = ? AND targetLanguage = ?`,
        [translatedVideoPath, contentId, targetLanguage]
      );

      return NextResponse.json({
        success: true,
        videoFile: translatedVideoPath,
        status: 'completed',
      });
    } catch (error: any) {
      // Update status to failed
      await pool.execute(
        `UPDATE content_translations 
         SET status = 'failed', updatedAt = CURRENT_TIMESTAMP
         WHERE contentId = ? AND targetLanguage = ?`,
        [contentId, targetLanguage]
      );

      throw error;
    }
  } catch (error: any) {
    console.error('Video processing error:', error);
    const errorMessage = error?.message || error?.toString() || 'Failed to process video translation';
    console.error('Error details:', {
      message: errorMessage,
      stack: error?.stack,
      contentId,
      sourceLanguage,
      targetLanguage,
    });
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Process video translation
async function processVideoTranslation(
  videoFilePath: string,
  contentId: number,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  // Get the full video file path
  const publicDir = path.join(process.cwd(), 'public');
  const fullVideoPath = path.join(publicDir, videoFilePath);

  // Check if video file exists
  try {
    await fs.access(fullVideoPath);
  } catch {
    throw new Error('Video file not found');
  }

  // Step 1 & 2: Transcribe audio to text (automatically extracts audio if needed)
  // The transcribeAudio function will:
  // - Check for existing transcript in database
  // - If not found, extract audio from video using FFmpeg
  // - Transcribe using OpenAI Whisper API (if configured)
  // - Save transcript to database for future use
  let transcript: string;
  try {
    console.log('Starting transcription process...');
    transcript = await transcribeAudio(fullVideoPath, sourceLanguage, contentId);
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Transcript is empty after transcription. Please check your video has audio.');
    }
    
    console.log(`✓ Transcript obtained (${transcript.length} characters)`);
  } catch (error: any) {
    console.error('Transcription error:', error);
    throw error; // Re-throw to preserve the detailed error message
  }

  // Step 3: Translate transcript
  console.log(`Translating from ${sourceLanguage} to ${targetLanguage}...`);
  const translatedText = await translateText(transcript, sourceLanguage, targetLanguage);
  console.log(`✓ Translation completed (${translatedText.length} characters)`);
  
  // Step 4: Generate speech from translated text
  console.log('Generating speech from translated text...');
  let newAudioPath: string;
  try {
    newAudioPath = await textToSpeech(translatedText, targetLanguage, contentId);
    console.log(`✓ Speech generated: ${newAudioPath}`);
  } catch (error: any) {
    console.error('Text-to-speech error:', error);
    throw new Error(`Text-to-speech failed: ${error.message}. Please configure a TTS service (Google Cloud TTS, AWS Polly, etc.)`);
  }
  
  // Step 5: Merge new audio with original video
  console.log('Merging translated audio with original video...');
  let translatedVideoPath: string;
  try {
    translatedVideoPath = await mergeAudioWithVideo(fullVideoPath, newAudioPath, contentId, targetLanguage);
    console.log(`✓ Audio merged successfully: ${translatedVideoPath}`);
  } catch (error: any) {
    console.error('Audio merge error:', error);
    // Clean up audio file if merge fails
    try {
      await fs.unlink(newAudioPath);
      console.log('✓ Cleaned up temporary audio file');
    } catch (cleanupError) {
      console.error('Failed to cleanup audio file:', cleanupError);
    }
    throw new Error(`Failed to merge audio with video: ${error.message}. Make sure FFmpeg is installed and accessible.`);
  }
  
  // Clean up temporary audio file
  try {
    await fs.unlink(newAudioPath);
    console.log('✓ Cleaned up temporary audio file');
  } catch (error) {
    console.error('Failed to cleanup audio file:', error);
  }

  // Return relative path
  const relativePath = path.relative(publicDir, translatedVideoPath).replace(/\\/g, '/');
  console.log(`✓ Translation complete! Output: ${relativePath}`);
  return relativePath;
}

// Extract audio from video (requires FFmpeg)
async function extractAudio(videoPath: string): Promise<string> {
  // Find FFmpeg executable
  const ffmpegPath = await findFFmpeg();
  
  const audioPath = videoPath.replace(/\.[^/.]+$/, '_audio.wav');
  
  try {
    // Extract audio using FFmpeg
    // -vn: disable video
    // -acodec pcm_s16le: PCM 16-bit little-endian audio codec
    // -ar 16000: sample rate 16kHz (good for speech recognition)
    // -ac 1: mono audio
    await execAsync(`"${ffmpegPath}" -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 -y "${audioPath}"`);
    return audioPath;
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    throw new Error(`FFmpeg failed to extract audio: ${errorMessage}`);
  }
}

// Transcribe audio using OpenAI Whisper API or local Whisper model
async function transcribeAudio(audioPath: string, language: string, contentId: number): Promise<string> {
  const pool = require('@/lib/db').default;
  
  // First, try to get transcript from database if available
  const [transcripts] = await pool.execute(
    'SELECT transcript FROM video_transcripts WHERE contentId = ? AND language = ? LIMIT 1',
    [contentId, language]
  ) as any[];

  if (transcripts && transcripts.length > 0 && transcripts[0].transcript) {
    console.log('✓ Using existing transcript from database');
    return transcripts[0].transcript;
  }

  // No transcript found - automatically transcribe the video audio
  console.log('No transcript found. Starting automatic transcription...');
  
  // Determine if we need to extract audio from video
  let audioToTranscribe = audioPath;
  let extractedAudioPath: string | null = null;
  const isVideoFile = audioPath.endsWith('.mp4') || audioPath.endsWith('.webm') || 
                     audioPath.endsWith('.mov') || audioPath.endsWith('.avi') ||
                     audioPath.endsWith('.mkv') || audioPath.endsWith('.flv');
  
  if (isVideoFile) {
    console.log('Extracting audio from video for transcription...');
    try {
      // Extract audio first using FFmpeg
      audioToTranscribe = await extractAudio(audioPath);
      extractedAudioPath = audioToTranscribe;
      console.log('✓ Audio extracted successfully');
    } catch (extractError: any) {
      console.error('Failed to extract audio:', extractError);
      throw new Error(
        `Failed to extract audio from video: ${extractError.message}\n\n` +
        'Make sure FFmpeg is installed and FFMPEG_PATH is set in your .env file.'
      );
    }
  }

  // Try OpenAI Whisper API first (faster, better quality if available)
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    try {
      return await transcribeWithOpenAI(audioToTranscribe, language, contentId, extractedAudioPath);
    } catch (error: any) {
      console.warn('OpenAI API transcription failed, falling back to local Whisper:', error.message);
      // Fall through to local Whisper
    }
  }

  // Fallback to local Whisper (free, no API key required)
  console.log('Using local Whisper for transcription (free, no API key required)...');
  try {
    return await transcribeWithLocalWhisper(audioToTranscribe, language, contentId, extractedAudioPath);
  } catch (error: any) {
    console.error('Local Whisper transcription error:', error);
    throw new Error(
      `Failed to transcribe audio: ${error.message}\n\n` +
      'Make sure @xenova/transformers is installed: npm install @xenova/transformers'
    );
  }
}

// Transcribe using OpenAI Whisper API
async function transcribeWithOpenAI(
  audioToTranscribe: string,
  language: string,
  contentId: number,
  extractedAudioPath: string | null
): Promise<string> {
  const pool = require('@/lib/db').default;
  const openaiApiKey = process.env.OPENAI_API_KEY!;
  
  console.log('Transcribing audio using OpenAI Whisper API...');
  const FormData = require('form-data');
  const formData = new FormData();
  const audioFile = await fs.readFile(audioToTranscribe);
  formData.append('file', audioFile, { 
    filename: audioToTranscribe.endsWith('.wav') ? 'audio.wav' : 'audio.mp3',
    contentType: audioToTranscribe.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg'
  });
  formData.append('model', 'whisper-1');
  formData.append('language', language);
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${openaiApiKey}`,
      ...formData.getHeaders()
    },
    body: formData,
  });
  
  // Clean up extracted audio file if we created one
  if (extractedAudioPath && extractedAudioPath !== audioToTranscribe) {
    try {
      await fs.unlink(extractedAudioPath);
      console.log('✓ Cleaned up temporary audio file');
    } catch (e) {
      console.error('Failed to cleanup extracted audio:', e);
    }
  }
  
  if (response.ok) {
    const data = await response.json();
    const transcriptText = data.text;
    
    // Save transcript to database for future use
    if (transcriptText && transcriptText.trim().length > 0) {
      try {
        await pool.execute(
          `INSERT INTO video_transcripts (contentId, language, transcript, createdAt, updatedAt)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE transcript = ?, updatedAt = CURRENT_TIMESTAMP`,
          [contentId, language, transcriptText, transcriptText]
        );
        console.log('✓ Transcript saved to database for future use');
      } catch (dbError) {
        console.error('Failed to save transcript to database:', dbError);
      }
    }
    
    return transcriptText;
  } else {
    const errorText = await response.text();
    console.error('OpenAI API error:', errorText);
    throw new Error(`OpenAI Whisper API error: ${errorText}`);
  }
}

// Transcribe using local Whisper model (free, no API key required)
async function transcribeWithLocalWhisper(
  audioToTranscribe: string,
  language: string,
  contentId: number,
  extractedAudioPath: string | null
): Promise<string> {
  const pool = require('@/lib/db').default;
  
  try {
    // Dynamically import @xenova/transformers
    const { pipeline } = await import('@xenova/transformers');
    
    console.log('Loading Whisper model (this may take a moment on first use)...');
    // Use a smaller model for faster processing (tiny, base, small, medium, large)
    // tiny is fastest but less accurate, base is a good balance
    const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
      device: 'cpu', // Use CPU (can be 'cuda' if you have GPU)
    });
    
    console.log('Model loaded. Transcribing audio...');
    const result = await transcriber(audioToTranscribe, {
      language: language === 'en' ? 'english' : language,
      task: 'transcribe',
    });
    
    const transcriptText = result.text || '';
    
    // Clean up extracted audio file if we created one
    if (extractedAudioPath && extractedAudioPath !== audioToTranscribe) {
      try {
        await fs.unlink(extractedAudioPath);
        console.log('✓ Cleaned up temporary audio file');
      } catch (e) {
        console.error('Failed to cleanup extracted audio:', e);
      }
    }
    
    if (!transcriptText || transcriptText.trim().length === 0) {
      throw new Error('Transcription returned empty result. The audio may be too quiet or unclear.');
    }
    
    // Save transcript to database for future use
    try {
      await pool.execute(
        `INSERT INTO video_transcripts (contentId, language, transcript, createdAt, updatedAt)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE transcript = ?, updatedAt = CURRENT_TIMESTAMP`,
        [contentId, language, transcriptText, transcriptText]
      );
      console.log('✓ Transcript saved to database for future use');
    } catch (dbError) {
      console.error('Failed to save transcript to database:', dbError);
    }
    
    console.log(`✓ Local Whisper transcription completed (${transcriptText.length} characters)`);
    return transcriptText;
  } catch (error: any) {
    // Clean up extracted audio file on error
    if (extractedAudioPath && extractedAudioPath !== audioToTranscribe) {
      try {
        await fs.unlink(extractedAudioPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    if (error.message && error.message.includes('Cannot find module')) {
      throw new Error(
        '@xenova/transformers is not installed. Please run: npm install @xenova/transformers'
      );
    }
    throw error;
  }
}

// Text-to-speech (generate audio from text)
async function textToSpeech(text: string, language: string, contentId: number): Promise<string> {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  const audioPath = path.join(uploadsDir, `translated_audio_${contentId}_${Date.now()}.mp3`);

  // Option 1: Use gtts (Google Text-to-Speech) - FREE, no API key required
  try {
    const gtts = require('gtts');
    
    // Map language codes to gtts language codes
    const languageMap: Record<string, string> = {
      'en': 'en',
      'ha': 'ha', // Hausa
      'ig': 'ig', // Igbo (may not be available, fallback to English)
      'yo': 'yo', // Yoruba (may not be available, fallback to English)
    };
    
    const ttsLanguage = languageMap[language] || 'en';
    
    return new Promise((resolve, reject) => {
      const tts = new gtts(text, ttsLanguage);
      tts.save(audioPath, (err: any) => {
        if (err) {
          console.error('gtts error:', err);
          // Fallback to English if language not supported
          if (ttsLanguage !== 'en') {
            console.log(`Language ${ttsLanguage} not supported, falling back to English`);
            const ttsEn = new gtts(text, 'en');
            ttsEn.save(audioPath, (err2: any) => {
              if (err2) {
                reject(new Error(`TTS failed: ${err2.message}`));
              } else {
                resolve(audioPath);
              }
            });
          } else {
            reject(new Error(`TTS failed: ${err.message}`));
          }
        } else {
          resolve(audioPath);
        }
      });
    });
  } catch (error: any) {
    console.error('gtts library error:', error);
    // Fallback to Google Cloud TTS API if API key is provided
    const googleTtsApiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
    if (googleTtsApiKey) {
      try {
        const languageMap: Record<string, string> = {
          'en': 'en-US',
          'ha': 'ha-NG',
          'ig': 'ig-NG',
          'yo': 'yo-NG',
        };
        
        const languageCode = languageMap[language] || language;
        
        const response = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleTtsApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: { text },
              voice: { 
                languageCode: languageCode,
                ssmlGender: 'NEUTRAL',
              },
              audioConfig: { 
                audioEncoding: 'MP3',
                speakingRate: 1.0,
                pitch: 0
              },
            }),
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const audioBuffer = Buffer.from(data.audioContent, 'base64');
          await fs.writeFile(audioPath, audioBuffer);
          return audioPath;
        } else {
          const errorText = await response.text();
          console.error('Google TTS API error:', errorText);
          throw new Error(`Google TTS API error: ${errorText}`);
        }
      } catch (apiError: any) {
        console.error('Google TTS API error:', apiError);
        throw new Error(`Text-to-speech failed: ${apiError.message}`);
      }
    }
    
    throw new Error(`Text-to-speech failed: ${error.message}. gtts library may not be installed correctly.`);
  }
}

// Merge audio with video
async function mergeAudioWithVideo(videoPath: string, audioPath: string, contentId: number, targetLang: string): Promise<string> {
  // Find FFmpeg executable
  const ffmpegPath = await findFFmpeg();
  
  const publicDir = path.join(process.cwd(), 'public');
  const uploadsDir = path.join(publicDir, 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  const outputPath = path.join(uploadsDir, `translated_${contentId}_${targetLang}_${Date.now()}.mp4`);
  
  try {
    // Merge audio with video using FFmpeg
    // -c:v copy: Copy video stream without re-encoding (faster)
    // -c:a aac: Encode audio as AAC
    // -map 0:v:0: Use first video stream from first input
    // -map 1:a:0: Use first audio stream from second input
    // -shortest: Finish encoding when the shortest input stream ends
    await execAsync(
      `"${ffmpegPath}" -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest -y "${outputPath}"`
    );
    return outputPath;
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    throw new Error(`FFmpeg failed to merge audio with video: ${errorMessage}`);
  }
}

