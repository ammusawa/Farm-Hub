import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { translateText } from '@/lib/translate';

const SUPPORTED_TRANSLATION_LANGS = new Set(['en', 'ha', 'ig', 'yo']);

// Teaser length for locked premium content (characters)
const TEASER_LENGTH = 400;

// Helper to check if user has active platform subscription
async function hasActivePlatformSubscription(userId: number | string): Promise<boolean> {
  try {
    const numericUserId = Number(userId); // Ensure ID is number
    console.log('[SUB CHECK] Checking subscription for userId:', numericUserId);

    const [rows] = await pool.execute(
      `SELECT id, status, currentPeriodEnd 
       FROM platform_subscriptions 
       WHERE userId = ? 
         AND status = 'active' 
         AND currentPeriodEnd > NOW()
       LIMIT 1`,
      [numericUserId]
    );

    const hasSub = (rows as any[]).length > 0;
    console.log('[SUB CHECK] Result:', hasSub ? 'ACTIVE SUB FOUND' : 'NO ACTIVE SUB', rows);

    return hasSub;
  } catch (err) {
    console.error('[SUB CHECK] ERROR:', err);
    return false;
  }
}

async function translateContentItems(items: any[], targetLanguage: string | null) {
  if (!targetLanguage || targetLanguage === 'default' || !SUPPORTED_TRANSLATION_LANGS.has(targetLanguage)) {
    return items;
  }

  const normalizeLang = (lang: string | null | undefined): string => {
    if (!lang) return 'en';
    const normalized = lang.split('-')[0].toLowerCase();
    return SUPPORTED_TRANSLATION_LANGS.has(normalized) ? normalized : 'en';
  };

  const cache = new Map<string, string>();

  const translateField = async (text: string, sourceLang: string) => {
    if (!text || !text.trim()) return text;
    const key = `${sourceLang}:${targetLanguage}:${text}`;
    if (cache.has(key)) return cache.get(key) as string;
    try {
      const translated = await translateText(text, sourceLang as any, targetLanguage as any);
      if (translated && translated !== text) {
        cache.set(key, translated);
        return translated;
      }
      return text;
    } catch (error: any) {
      console.error('Translation error for field:', error);
      return text;
    }
  };

  for (const item of items) {
    const sourceLang = normalizeLang(item.language);
    if (sourceLang === targetLanguage) continue;

    try {
      if (item.title && item.title.trim()) {
        item.title = await translateField(item.title, sourceLang);
      }
      if (item.body && item.body.trim()) {
        item.body = await translateField(item.body, sourceLang);
      }

      item.originalLanguage = sourceLang;
      item.translatedToLanguage = targetLanguage;
      item.wasTranslated = true;
      item.language = targetLanguage;
    } catch (error: any) {
      console.error('Translation error for item:', item.id, error);
    }
  }

  return items;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const isAdmin = user?.role === 'admin';
    const hasActiveSub = user && !isAdmin && (await hasActivePlatformSubscription(user.id));
    const hasAccessToPremium = isAdmin || hasActiveSub;

    console.log('[CONTENT GET] User:', user?.id, 'Role:', user?.role, 'Has premium access:', hasAccessToPremium);

    const { searchParams } = new URL(request.url);
    const languageFilter = searchParams.get('language');
    const cropType = searchParams.get('crop');
    let contentType = searchParams.get('type');
    const authorId = searchParams.get('authorId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const targetLanguage = (searchParams.get('translate') || '').toLowerCase() || null;

    // Treat missing type or type=all the same way
    if (!contentType || contentType === 'all') {
      contentType = 'all';
    }

    let query = `
      SELECT c.*, u.name as authorName, c.authorId,
      AVG(r.stars) as avgRating,
      COUNT(DISTINCT r.id) as ratingCount
      FROM content c
      LEFT JOIN users u ON c.authorId = u.id
      LEFT JOIN ratings r ON c.id = r.contentId
      WHERE 1=1
    `;
    
    const params: any[] = [];

    if (languageFilter) {
      query += ' AND c.language = ?';
      params.push(languageFilter);
    }

    if (cropType) {
      query += ' AND c.cropType = ?';
      params.push(cropType);
    }

    // Apply content type filter (including special handling for paid/all)
    if (contentType) {
      if (contentType === 'paid') {
        query += ' AND c.isPremium = 1';
      } else if (contentType === 'all') {
        // For unpaid users: hide premium content
        if (!hasAccessToPremium) {
          query += ' AND c.isPremium = 0';
          console.log('[CONTENT GET] Hiding premium content for non-subscribed user in All Types');
        }
        // No contentType filter added — shows all types (free only for unpaid)
      } else {
        // Specific type (video, article, tip)
        query += ' AND c.contentType = ?';
        params.push(contentType);

        // For unpaid users: also hide premium items in specific type views
        if (!hasAccessToPremium) {
          query += ' AND c.isPremium = 0';
          console.log(`[CONTENT GET] Hiding premium ${contentType} content for non-subscribed user`);
        }
      }
    }

    if (authorId) {
      query += ' AND c.authorId = ?';
      params.push(parseInt(authorId));
    }

    query += ' GROUP BY c.id ORDER BY c.createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    console.log('[CONTENT GET] Executing query:', query);
    console.log('[CONTENT GET] Params:', params);

    const [rows] = await pool.execute(query, params);

    const processedRows = rows.map((item: any) => {
      const isPremium = item.isPremium === 1;
      const isOwner = user && item.authorId === user.id;

      // Owner, admin, or subscribed → full access
      if (isOwner || hasAccessToPremium) {
        return { ...item, isLocked: false };
      }

      // Non-subscribed non-owners get teaser for premium
      if (isPremium) {
        return {
          ...item,
          body: item.body?.substring(0, TEASER_LENGTH) + (item.body?.length > TEASER_LENGTH ? '...' : '') || '',
          isLocked: true,
          teaserLength: TEASER_LENGTH,
        };
      }

      return { ...item, isLocked: false };
    });

    await translateContentItems(processedRows, targetLanguage);

    return NextResponse.json({ 
      content: processedRows,
      userAccess: {
        hasPremiumAccess: hasAccessToPremium,
        isAdmin: isAdmin,
        isSubscribed: hasActiveSub,
        userId: user?.id || null
      }
    });
  } catch (error: any) {
    console.error('GET /api/content error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch content' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [users] = await pool.execute(
      'SELECT id, role, isVerifiedProfessional FROM users WHERE id = ?',
      [user.id]
    ) as any[];

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const dbUser = users[0];
    if (dbUser.role !== 'professional' || !dbUser.isVerifiedProfessional) {
      return NextResponse.json(
        { error: 'Only verified professionals can upload content' },
        { status: 403 }
      );
    }

    const { 
      title, 
      body, 
      language, 
      cropType, 
      contentType, 
      tags, 
      videoFile,
      videoDuration,
      videoSize,
      videoFormat,
      videoResolution,
      isPremium = false,
      premiumPrice
    } = await request.json();

    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    if (isPremium) {
      if (title.trim().length < 10 || body.trim().length < 50) {
        return NextResponse.json(
          { error: 'Premium content must have meaningful title and body (min 10/50 chars)' },
          { status: 400 }
        );
      }
    }

    if (contentType === 'video' && !videoFile) {
      return NextResponse.json(
        { error: 'Video file path is required for video content' },
        { status: 400 }
      );
    }

    let result: any;
    try {
      [result] = await pool.execute(
        `INSERT INTO content (
          title, body, language, authorId, cropType, contentType, tags,
          videoFile, videoDuration, videoSize, videoFormat, videoResolution,
          isPremium, premiumPrice
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title.trim(),
          body.trim(),
          language || 'en',
          dbUser.id,
          cropType || null,
          contentType || 'article',
          tags || null,
          videoFile || null,
          videoDuration || null,
          videoSize || null,
          videoFormat || null,
          videoResolution || null,
          isPremium ? 1 : 0,
          premiumPrice !== undefined && premiumPrice !== '' ? Number(premiumPrice) : null
        ]
      );
      console.log('Content created with premium fields:', { 
        id: result.insertId, 
        isPremium, 
        premiumPrice 
      });
    } catch (err: any) {
      if (err.code === 'ER_BAD_FIELD_ERROR' || err.message?.includes('Unknown column')) {
        console.warn('Premium columns missing - falling back to basic insert');
        [result] = await pool.execute(
          `INSERT INTO content (
            title, body, language, authorId, cropType, contentType, tags,
            videoFile, videoDuration, videoSize, videoFormat, videoResolution
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            title.trim(), body.trim(), language || 'en', dbUser.id,
            cropType || null, contentType || 'article', tags || null,
            videoFile || null, videoDuration || null, videoSize || null,
            videoFormat || null, videoResolution || null
          ]
        );
        console.warn('Used fallback insert - premium fields NOT saved');
      } else {
        console.error('Insert failed:', err);
        throw err;
      }
    }

    return NextResponse.json({
      success: true,
      content: {
        id: result.insertId,
        title,
        isPremium,
        premiumPrice: premiumPrice !== undefined ? Number(premiumPrice) : null
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/content error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create content' },
      { status: 500 }
    );
  }
}