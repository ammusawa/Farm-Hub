import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { translateText } from '@/lib/translate';

const TEASER_LENGTH = 400;

async function translateContentItem(item: any, targetLanguage: string | null) {
  if (!targetLanguage || targetLanguage === 'default' || !['en', 'ha', 'ig', 'yo'].includes(targetLanguage)) {
    return item;
  }

  const normalizeLang = (lang: string | null | undefined): string => {
    if (!lang) return 'en';
    const normalized = lang.split('-')[0].toLowerCase();
    return ['en', 'ha', 'ig', 'yo'].includes(normalized) ? normalized : 'en';
  };

  const sourceLang = normalizeLang(item.language);
  if (sourceLang === targetLanguage) return item;

  try {
    if (item.title && item.title.trim()) {
      const translatedTitle = await translateText(item.title, sourceLang as any, targetLanguage as any);
      if (translatedTitle && translatedTitle !== item.title) {
        item.title = translatedTitle;
      }
    }

    if (item.body && item.body.trim()) {
      const translatedBody = await translateText(item.body, sourceLang as any, targetLanguage as any);
      if (translatedBody && translatedBody !== item.body) {
        item.body = translatedBody;
      }
    }

    item.originalLanguage = sourceLang;
    item.translatedToLanguage = targetLanguage;
    item.wasTranslated = true;
    item.language = targetLanguage;
  } catch (error: any) {
    console.error('Translation error:', error);
    item.translationError = error.message || 'Translation failed';
  }

  return item;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request);

    // Admin always has full access — no subscription needed
    const isAdmin = user?.role === 'admin';
    const hasActiveSub = user && !isAdmin && (await hasActivePlatformSubscription(user.id));
    const hasAccessToPremium = isAdmin || hasActiveSub;

    const [rows] = await pool.execute(
      `SELECT c.*, u.name as authorName,
       AVG(r.stars) as avgRating,
       COUNT(DISTINCT r.id) as ratingCount
       FROM content c
       LEFT JOIN users u ON c.authorId = u.id
       LEFT JOIN ratings r ON c.id = r.contentId
       WHERE c.id = ?
       GROUP BY c.id`,
      [params.id]
    ) as any[];

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    let content = rows[0];

    const isPremium = content.isPremium === 1;
    const isOwner = user && content.authorId === user.id;

    // Admin or owner or subscribed → full content
    if (isOwner || isAdmin || hasActiveSub) {
      content.isLocked = false;
    } else if (isPremium) {
      // Teaser for everyone else
      content = {
        ...content,
        body: content.body?.substring(0, TEASER_LENGTH) + (content.body?.length > TEASER_LENGTH ? '...' : '') || '',
        isLocked: true,
        teaserLength: TEASER_LENGTH,
      };
    } else {
      content.isLocked = false;
    }

    const { searchParams } = new URL(request.url);
    const targetLanguage = (searchParams.get('translate') || '').toLowerCase() || null;
    await translateContentItem(content, targetLanguage);

    return NextResponse.json({ content });
  } catch (error: any) {
    console.error('GET /api/content/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch content' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [contentRows] = await pool.execute(
      'SELECT authorId FROM content WHERE id = ?',
      [params.id]
    ) as any[];

    if (!contentRows || contentRows.length === 0) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    if (contentRows[0].authorId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized - you can only edit your own content' }, { status: 403 });
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

    try {
      await pool.execute(
        `UPDATE content 
         SET title = ?, body = ?, language = ?, cropType = ?, contentType = ?, tags = ?,
             videoFile = ?, videoDuration = ?, videoSize = ?, videoFormat = ?, videoResolution = ?,
             isPremium = ?, premiumPrice = ?
         WHERE id = ?`,
        [
          title?.trim(),
          body?.trim(),
          language || 'en',
          cropType || null,
          contentType || 'article',
          tags || null,
          videoFile !== undefined ? videoFile : null,
          videoDuration !== undefined ? videoDuration : null,
          videoSize !== undefined ? videoSize : null,
          videoFormat !== undefined ? videoFormat : null,
          videoResolution !== undefined ? videoResolution : null,
          isPremium ? 1 : 0,
          premiumPrice !== undefined && premiumPrice !== '' ? Number(premiumPrice) : null,
          params.id
        ]
      );
    } catch (err: any) {
      if (err.code === 'ER_BAD_FIELD_ERROR' || err.message?.includes('Unknown column')) {
        console.warn('Premium columns missing - falling back to basic update');
        await pool.execute(
          `UPDATE content 
           SET title = ?, body = ?, language = ?, cropType = ?, contentType = ?, tags = ?,
               videoFile = ?, videoDuration = ?, videoSize = ?, videoFormat = ?, videoResolution = ?
           WHERE id = ?`,
          [
            title?.trim(), body?.trim(), language || 'en', cropType || null,
            contentType || 'article', tags || null,
            videoFile !== undefined ? videoFile : null,
            videoDuration !== undefined ? videoDuration : null,
            videoSize !== undefined ? videoSize : null,
            videoFormat !== undefined ? videoFormat : null,
            videoResolution !== undefined ? videoResolution : null,
            params.id
          ]
        );
      } else {
        throw err;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('PUT /api/content/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update content' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [contentRows] = await pool.execute(
      'SELECT authorId, videoFile FROM content WHERE id = ?',
      [params.id]
    ) as any[];

    if (!contentRows || contentRows.length === 0) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    if (contentRows[0].authorId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized. You can only delete your own content.' },
        { status: 403 }
      );
    }

    await pool.execute('DELETE FROM ratings WHERE contentId = ?', [params.id]);
    await pool.execute('DELETE FROM comments WHERE contentId = ?', [params.id]);

    try {
      await pool.execute('DELETE FROM video_transcripts WHERE contentId = ?', [params.id]);
    } catch (err) {
      console.warn('Could not delete video transcripts:', err);
    }

    if (contentRows[0].videoFile) {
      try {
        const { unlink } = await import('fs/promises');
        const { join } = await import('path');
        const videoPath = join(process.cwd(), 'public', contentRows[0].videoFile);
        await unlink(videoPath);
        console.log('Deleted video file:', videoPath);
      } catch (fileErr: any) {
        console.warn('Could not delete video file:', fileErr.message);
      }
    }

    await pool.execute('DELETE FROM content WHERE id = ?', [params.id]);

    return NextResponse.json({ success: true, message: 'Content deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/content/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete content' },
      { status: 500 }
    );
  }
}

async function hasActivePlatformSubscription(userId: number): Promise<boolean> {
  try {
    const [rows] = await pool.execute(
      `SELECT id 
       FROM platform_subscriptions 
       WHERE userId = ? 
         AND status = 'active' 
         AND currentPeriodEnd > NOW()
       LIMIT 1`,
      [userId]
    );
    return (rows as any[]).length > 0;
  } catch (err) {
    console.error('Subscription check failed:', err);
    return false;
  }
}