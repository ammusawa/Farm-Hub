import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
	try {
		const user = await getAuthUser(request);
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Ensure professional
		const [rows] = await pool.execute(
			'SELECT role FROM users WHERE id = ?',
			[user.id]
		) as any[];
		if (!rows || rows.length === 0 || rows[0].role !== 'professional') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// Aggregate metrics
		const [[subs]]: any = await pool.query(
			'SELECT COUNT(*) AS count FROM subscriptions WHERE professionalId = ?',
			[user.id]
		) as any;

		const [[likes]]: any = await pool.query(
			`SELECT COUNT(*) AS count
       FROM content_likes cl
       JOIN content c ON c.id = cl.contentId
       WHERE c.authorId = ? AND cl.type = 'like'`,
			[user.id]
		) as any;

		const [[comments]]: any = await pool.query(
			`SELECT COUNT(*) AS count
       FROM comments cm
       JOIN content c ON c.id = cm.contentId
       WHERE c.authorId = ?`,
			[user.id]
		) as any;

		const [[videos]]: any = await pool.query(
			`SELECT COUNT(*) AS count
       FROM content
       WHERE authorId = ? AND contentType = 'video'`,
			[user.id]
		) as any;

		// Per-video breakdown
		const [perVideo] = await pool.execute(
			`SELECT 
         c.id,
         c.title,
         c.createdAt,
         c.videoDuration,
         COALESCE(SUM(CASE WHEN cl.type = 'like' THEN 1 ELSE 0 END), 0) AS likes,
         COUNT(DISTINCT cm.id) AS comments
       FROM content c
       LEFT JOIN content_likes cl ON cl.contentId = c.id
       LEFT JOIN comments cm ON cm.contentId = c.id
       WHERE c.authorId = ? AND c.contentType = 'video'
       GROUP BY c.id
       ORDER BY c.createdAt DESC`,
			[user.id]
		) as any[];

		// Views tracking is not implemented in current schema
		// Return views as 0 placeholder for now
		const videoStats = (perVideo as any[]).map(v => ({
			id: v.id,
			title: v.title,
			createdAt: v.createdAt,
			videoDuration: v.videoDuration,
			likes: Number(v.likes) || 0,
			comments: Number(v.comments) || 0,
			views: 0
		}));

		return NextResponse.json({
			totals: {
				subscribers: Number(subs?.count || 0),
				likes: Number(likes?.count || 0),
				comments: Number(comments?.count || 0),
				videos: Number(videos?.count || 0),
				views: 0
			},
			videos: videoStats
		});
	} catch (error: any) {
		return NextResponse.json(
			{ error: error.message || 'Failed to fetch analytics' },
			{ status: 500 }
		);
	}
}


