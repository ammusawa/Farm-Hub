'use client';

import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import ConfirmationModal from './ConfirmationModal';
import { useLanguage } from '@/app/contexts/LanguageContext';

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    loadUser();
    const interval = setInterval(loadUser, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadPendingCount();
    } else {
      setPendingCount(null);
    }
  }, [user]);

  const loadUser = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);

        // Check subscription status
        if (data.user.role !== 'admin') {
          const subRes = await fetch('/api/subscription-status', {
            credentials: 'include',
          });
          const subData = await subRes.json();
          setHasActiveSubscription(subData.hasActiveSubscription || false);
        } else {
          setHasActiveSubscription(true); // Admins always "paid"
        }
      }
    } catch (err) {
      console.error('Navbar user load error:', err);
    }
  };

  const loadPendingCount = async () => {
    if (!user || user.role !== 'admin') return;

    try {
      const res = await fetch('/api/admin/applications', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const pending = data.applications?.filter((app: any) => app.status === 'pending') || [];
        setPendingCount(pending.length > 0 ? pending.length : null);
      }
    } catch (err) {
      console.error('Pending count error:', err);
      setPendingCount(null);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { 
      method: 'POST',
      credentials: 'include',
    });
    window.location.href = '/';
  };

  const isAdmin = user?.role === 'admin';
  const isProfessional = user?.role === 'professional';
  const isVerifiedProfessional = isProfessional && user?.isVerifiedProfessional;
  const isPremiumUser = isAdmin || hasActiveSubscription;

  return (
    <nav className="bg-primary-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold flex items-center gap-2">
            <Leaf className="h-7 w-7 text-emerald-100 shrink-0" strokeWidth={2.2} />
            {t('app.name')}
          </Link>

          <div className="flex items-center gap-4">
            {/* Language Switcher - conditional based on subscription */}
            {isPremiumUser ? (
              <LanguageSwitcher />
            ) : (
              <div className="px-3 py-2 rounded bg-primary-700/50 text-gray-300 cursor-not-allowed flex items-center gap-2">
                <span>English (default)</span>
                <span className="text-xs bg-amber-500/30 px-2 py-0.5 rounded-full">
                  Premium Only
                </span>
              </div>
            )}

            <Link
              href="/"
              className={`px-3 py-2 rounded ${pathname === '/' ? 'bg-primary-700' : ''}`}
            >
              {t('nav.home')}
            </Link>

            {user && (
              <>
                <Link
                  href="/subscriptions"
                  className={`px-3 py-2 rounded ${pathname === '/subscriptions' ? 'bg-primary-700' : ''}`}
                >
                  {t('nav.subscriptions')}
                </Link>
                <Link
                  href="/profile"
                  className={`px-3 py-2 rounded ${pathname === '/profile' ? 'bg-primary-700' : ''}`}
                >
                  {t('nav.profile')}
                </Link>
              </>
            )}

            {isVerifiedProfessional && (
              <Link
                href="/upload"
                className={`px-3 py-2 rounded ${pathname === '/upload' ? 'bg-primary-700' : ''}`}
              >
                {t('nav.upload')}
              </Link>
            )}

            {isAdmin && (
              <>
                <Link
                  href="/admin/users"
                  className={`px-3 py-2 rounded ${pathname === '/admin/users' ? 'bg-primary-700' : ''}`}
                >
                  {t('nav.users')}
                </Link>
                <Link
                  href="/admin/applications"
                  className={`px-3 py-2 rounded relative ${pathname === '/admin/applications' ? 'bg-primary-700' : ''}`}
                >
                  {t('nav.applications')}
                  {pendingCount && pendingCount > 0 ? (
                    <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                      {pendingCount}
                    </span>
                  ) : null}
                </Link>
              </>
            )}

            {!user ? (
              <Link href="/login" className="px-3 py-2 rounded bg-primary-700 hover:bg-primary-800">
                {t('nav.login')}
              </Link>
            ) : (
              <button
                onClick={() => setShowLogoutModal(true)}
                className="px-3 py-2 rounded bg-primary-700 hover:bg-primary-800"
              >
                {t('nav.logout')}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        title="Confirm Logout"
        message="Are you sure you want to logout? You will need to login again to access your account."
        confirmText="Logout"
        cancelText="Cancel"
        confirmButtonColor="primary"
      />
    </nav>
  );
}