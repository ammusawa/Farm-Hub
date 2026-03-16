import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import pool from '@/lib/db';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    redirect('/login');
  }

  const user = verifyToken(token);
  if (!user) {
    redirect('/login');
  }

  // Check database for current role (in case user was promoted to admin)
  try {
    const [users] = await pool.execute(
      'SELECT role FROM users WHERE id = ?',
      [user.id]
    ) as any[];

    if (!users || users.length === 0 || users[0].role !== 'admin') {
      redirect('/login');
    }
  } catch (error) {
    redirect('/login');
  }

  return <>{children}</>;
}

