import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ hasActiveSubscription: false });
    }

    const [rows] = await pool.execute(
      `SELECT id 
       FROM platform_subscriptions 
       WHERE userId = ? 
         AND status = 'active' 
         AND currentPeriodEnd > NOW()
       LIMIT 1`,
      [user.id]
    );

    const hasActive = (rows as any[]).length > 0;

    return NextResponse.json({ 
      hasActiveSubscription: hasActive,
      isAdmin: user.role === 'admin'
    });
  } catch (err) {
    console.error('Subscription status check failed:', err);
    return NextResponse.json({ 
      hasActiveSubscription: false,
      isAdmin: false 
    });
  }
}