import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { translateText } from '@/lib/translate';

const SUPPORTED_TRANSLATION_LANGS = new Set(['en', 'ha', 'ig', 'yo']);

async function translateSearchResults(items: any[], targetLanguage: string | null) {
  // If 'default' or null, don't translate - show original content language
  if (!targetLanguage || targetLanguage === 'default' || !SUPPORTED_TRANSLATION_LANGS.has(targetLanguage)) {
    return items;
  }

  const cache = new Map<string, string>();
  const translateField = async (text: string, sourceLang: string) => {
    if (!text || !text.trim()) return text;
    const key = `${sourceLang}:${targetLanguage}:${text}`;
    if (cache.has(key)) {
      return cache.get(key) as string;
    }
    const translated = await translateText(text, sourceLang as any, targetLanguage as any);
    cache.set(key, translated);
    return translated;
  };

  for (const item of items) {
    const sourceLang = (item.language || 'en').split('-')[0];
    if (sourceLang === targetLanguage) continue;
    if (item.title) {
      item.title = await translateField(item.title, sourceLang);
    }
    if (item.body) {
      item.body = await translateField(item.body, sourceLang);
    }
    item.originalLanguage = sourceLang;
    item.translatedToLanguage = targetLanguage;
    item.wasTranslated = true;
    item.language = targetLanguage;
  }

  return items;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const languageFilter = searchParams.get('language');
    const cropType = searchParams.get('crop');
    const contentType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '10');
    const targetLanguage = (searchParams.get('translate') || '').toLowerCase() || null;

    if (!q.trim()) {
      return NextResponse.json({ results: [] });
    }

    let query = `
      SELECT c.id, c.title, c.body, c.language, c.cropType, c.contentType,
      u.name as authorName,
      MATCH(c.title, c.body, c.tags) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
      FROM content c
      LEFT JOIN users u ON c.authorId = u.id
      WHERE MATCH(c.title, c.body, c.tags) AGAINST(? IN NATURAL LANGUAGE MODE)
    `;
    const params: any[] = [q, q];

    if (languageFilter) {
      query += ' AND c.language = ?';
      params.push(languageFilter);
    }

    if (cropType) {
      query += ' AND c.cropType = ?';
      params.push(cropType);
    }

    if (contentType) {
      query += ' AND c.contentType = ?';
      params.push(contentType);
    }

    query += ' ORDER BY relevance DESC LIMIT ?';
    params.push(limit);

    const [rows] = await pool.execute(query, params);
    await translateSearchResults(rows as any[], targetLanguage);

    return NextResponse.json({ results: rows });
  } catch (error: any) {
    // Fallback to LIKE search if FULLTEXT fails
    try {
      const { searchParams } = new URL(request.url);
      const q = searchParams.get('q') || '';
      const languageFilter = searchParams.get('language');
      const cropType = searchParams.get('crop');
      const contentType = searchParams.get('type');
      const limit = parseInt(searchParams.get('limit') || '10');
      const targetLanguage = (searchParams.get('translate') || '').toLowerCase() || null;

      let query = `
        SELECT c.id, c.title, c.body, c.language, c.cropType, c.contentType,
        u.name as authorName
        FROM content c
        LEFT JOIN users u ON c.authorId = u.id
        WHERE (c.title LIKE ? OR c.body LIKE ? OR c.tags LIKE ?)
      `;
      const searchTerm = `%${q}%`;
      const params: any[] = [searchTerm, searchTerm, searchTerm];

      if (languageFilter) {
        query += ' AND c.language = ?';
        params.push(languageFilter);
      }

      if (cropType) {
        query += ' AND c.cropType = ?';
        params.push(cropType);
      }

      if (contentType) {
        query += ' AND c.contentType = ?';
        params.push(contentType);
      }

      query += ' ORDER BY c.createdAt DESC LIMIT ?';
      params.push(limit);

      const [rows] = await pool.execute(query, params);
      await translateSearchResults(rows as any[], targetLanguage);
      return NextResponse.json({ results: rows });
    } catch (fallbackError: any) {
      return NextResponse.json(
        { error: fallbackError.message || 'Search failed' },
        { status: 500 }
      );
    }
  }
}

