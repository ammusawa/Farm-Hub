async function hasActivePlatformSubscription(userId: number | string): Promise<boolean> {
  const numericUserId = Number(userId);
  console.log('[SUB CHECK] Normalized userId:', numericUserId);

  try {
    const [rows] = await pool.execute(
      `SELECT id, userId, status, currentPeriodEnd 
       FROM platform_subscriptions 
       WHERE userId = ? 
         AND status = 'active' 
         AND currentPeriodEnd > NOW()
       LIMIT 1`,
      [numericUserId]
    );

    console.log('[SUB CHECK] Rows:', rows);
    return (rows as any[]).length > 0;
  } catch (err) {
    console.error('[SUB CHECK] ERROR:', err);
    return false;
  }
}