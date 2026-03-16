import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// Get subscription status and count
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get('professionalId');
    const mode = searchParams.get('mode');

    // Return list of subscribers for the current professional
    if (mode === 'subscribers') {
      // Ensure current user is a professional
      const [rows] = await pool.execute(
        'SELECT role FROM users WHERE id = ?',
        [user.id]
      ) as any[];
      if (!rows || rows.length === 0 || rows[0].role !== 'professional') {
        return NextResponse.json(
          { error: 'Only professional accounts can view subscribers' },
          { status: 403 }
        );
      }

      const [subscribers] = await pool.execute(
        `SELECT s.subscriberId, u.name as subscriberName, u.email as subscriberEmail, s.createdAt
         FROM subscriptions s
         JOIN users u ON s.subscriberId = u.id
         WHERE s.professionalId = ?
         ORDER BY s.createdAt DESC`,
        [user.id]
      ) as any[];

      return NextResponse.json({ subscribers: subscribers || [] });
    }

    if (professionalId) {
      // Check if user is subscribed to this professional
      const [subscriptions] = await pool.execute(
        'SELECT id FROM subscriptions WHERE subscriberId = ? AND professionalId = ?',
        [user.id, parseInt(professionalId)]
      ) as any[];

      // Get subscription count for this professional
      const [counts] = await pool.execute(
        'SELECT COUNT(*) as count FROM subscriptions WHERE professionalId = ?',
        [parseInt(professionalId)]
      ) as any[];

      return NextResponse.json({
        isSubscribed: subscriptions && subscriptions.length > 0,
        subscriberCount: counts[0]?.count || 0,
      });
    }

    // Get all subscriptions for the current user
    const [subscriptions] = await pool.execute(
      `SELECT s.professionalId, u.name as professionalName, u.email as professionalEmail, s.createdAt
       FROM subscriptions s
       JOIN users u ON s.professionalId = u.id
       WHERE s.subscriberId = ?
       ORDER BY s.createdAt DESC`,
      [user.id]
    ) as any[];

    return NextResponse.json({ subscriptions: subscriptions || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

// Subscribe or unsubscribe
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { professionalId, action } = await request.json();

    if (!professionalId || !action) {
      return NextResponse.json(
        { error: 'Professional ID and action are required' },
        { status: 400 }
      );
    }

    if (!['subscribe', 'unsubscribe'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "subscribe" or "unsubscribe"' },
        { status: 400 }
      );
    }

    // Verify professional exists and is actually a professional
    const [professionals] = await pool.execute(
      'SELECT id, role FROM users WHERE id = ?',
      [professionalId]
    ) as any[];

    if (!professionals || professionals.length === 0) {
      return NextResponse.json(
        { error: 'Professional not found' },
        { status: 404 }
      );
    }

    if (professionals[0].role !== 'professional') {
      return NextResponse.json(
        { error: 'User is not a professional' },
        { status: 400 }
      );
    }

    if (user.id === parseInt(professionalId)) {
      return NextResponse.json(
        { error: 'Cannot subscribe to yourself' },
        { status: 400 }
      );
    }

    if (action === 'subscribe') {
      // Check if already subscribed
      const [existing] = await pool.execute(
        'SELECT id FROM subscriptions WHERE subscriberId = ? AND professionalId = ?',
        [user.id, professionalId]
      ) as any[];

      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: 'Already subscribed' },
          { status: 400 }
        );
      }

      // Create subscription
      await pool.execute(
        'INSERT INTO subscriptions (subscriberId, professionalId) VALUES (?, ?)',
        [user.id, professionalId]
      );
    } else {
      // Unsubscribe
      await pool.execute(
        'DELETE FROM subscriptions WHERE subscriberId = ? AND professionalId = ?',
        [user.id, professionalId]
      );
    }

    // Get updated subscription count
    const [counts] = await pool.execute(
      'SELECT COUNT(*) as count FROM subscriptions WHERE professionalId = ?',
      [professionalId]
    ) as any[];

    return NextResponse.json({
      success: true,
      isSubscribed: action === 'subscribe',
      subscriberCount: counts[0]?.count || 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

