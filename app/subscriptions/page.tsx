'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Subscription {
  professionalId: number;
  professionalName: string;
  professionalEmail: string;
  createdAt: string;
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    loadUser();
    // subscriptions/subscribers will load after user role is known
  }, []);

  const loadUser = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        if (data.user.role === 'professional') {
          await loadAnalytics();
          await loadSubscribers();
        } else {
          await loadSubscriptions();
        }
      } else {
        router.push('/login');
      }
    } catch (error) {
      router.push('/login');
    }
  };

  const loadAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics/professional', {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const loadSubscriptions = async () => {
    try {
      const res = await fetch('/api/subscriptions', {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setSubscriptions(data.subscriptions || []);
      }
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubscribers = async () => {
    try {
      const res = await fetch('/api/subscriptions?mode=subscribers', {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setSubscribers(data.subscribers || []);
      }
    } catch (error) {
      console.error('Failed to load subscribers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-900">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          {user?.role === 'professional' ? 'My Subscribers' : 'My Subscriptions'}
        </h1>
        <Link
          href="/"
          className="px-4 py-2 text-primary-600 hover:text-primary-700"
        >
          ← Back to Home
        </Link>
      </div>

      {user?.role === 'professional' ? (
        <>
          {/* Analytics Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500">Views</div>
              <div className="text-2xl font-semibold text-gray-900">{analytics?.totals?.views ?? 0}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500">Likes</div>
              <div className="text-2xl font-semibold text-gray-900">{analytics?.totals?.likes ?? 0}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500">Comments</div>
              <div className="text-2xl font-semibold text-gray-900">{analytics?.totals?.comments ?? 0}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500">Subscribers</div>
              <div className="text-2xl font-semibold text-gray-900">{analytics?.totals?.subscribers ?? 0}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500">Videos</div>
              <div className="text-2xl font-semibold text-gray-900">{analytics?.totals?.videos ?? 0}</div>
            </div>
          </div>

          {/* Per-Video Table */}
          <div className="bg-white rounded-lg shadow mb-8 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Video analytics</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Published</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Views</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Likes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comments</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(analytics?.videos || []).map((v: any) => (
                    <tr key={v.id}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 line-clamp-2">{v.title}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{v.views ?? 0}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{v.likes ?? 0}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{v.comments ?? 0}</td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/content/${v.id}`} className="text-primary-600 hover:text-primary-700 text-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {(!analytics?.videos || analytics.videos.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-6 text-center text-sm text-gray-500">
                        No videos yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {user?.role === 'professional' ? (
        subscribers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              No Subscribers Yet
            </h2>
            <p className="text-gray-600 mb-6">
              Share helpful content to attract subscribers.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Create and Share Content
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {subscribers.map((sub: any) => (
              <div
                key={sub.subscriberId}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-xl">
                      {sub.subscriberName?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800">
                        {sub.subscriberName}
                      </h3>
                      <p className="text-sm text-gray-600">{sub.subscriberEmail}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Subscribed on {formatDate(sub.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : subscriptions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-6xl mb-4">📺</div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            No Subscriptions Yet
          </h2>
          <p className="text-gray-600 mb-6">
            Start following professional farmers to see their latest content in one place.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Browse Content
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((sub) => (
            <div
              key={sub.professionalId}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-xl">
                    {sub.professionalName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">
                      {sub.professionalName}
                    </h3>
                    <p className="text-sm text-gray-600">{sub.professionalEmail}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Subscribed on {formatDate(sub.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/?authorId=${sub.professionalId}&authorName=${encodeURIComponent(sub.professionalName)}`}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    View Content
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

