'use client';

import { useState, useEffect } from 'react';

interface SubscribeButtonProps {
  professionalId: number;
  professionalName?: string;
  variant?: 'default' | 'compact';
}

export default function SubscribeButton({ 
  professionalId, 
  professionalName,
  variant = 'default' 
}: SubscribeButtonProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadSubscriptionStatus();
  }, [professionalId]);

  const loadSubscriptionStatus = async () => {
    try {
      const res = await fetch(`/api/subscriptions?professionalId=${professionalId}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setIsSubscribed(data.isSubscribed);
        setSubscriberCount(data.subscriberCount || 0);
      }
    } catch (error) {
      console.error('Failed to load subscription status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          professionalId,
          action: isSubscribed ? 'unsubscribe' : 'subscribe',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsSubscribed(data.isSubscribed);
        setSubscriberCount(data.subscriberCount || 0);
      } else {
        alert(data.error || 'Failed to update subscription');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`${variant === 'compact' ? 'px-3 py-1' : 'px-4 py-2'} bg-gray-200 rounded-lg animate-pulse`}>
        <span className="text-transparent">Loading...</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubscribe}
          disabled={actionLoading}
          className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
            isSubscribed
              ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              : 'bg-red-600 text-white hover:bg-red-700'
          } disabled:opacity-50`}
        >
          {actionLoading ? '...' : isSubscribed ? 'Subscribed' : 'Subscribe'}
        </button>
        {subscriberCount > 0 && (
          <span className="text-xs text-gray-500">
            {subscriberCount.toLocaleString()} {subscriberCount === 1 ? 'subscriber' : 'subscribers'}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSubscribe}
        disabled={actionLoading}
        className={`px-6 py-2 font-semibold rounded-lg transition-colors ${
          isSubscribed
            ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            : 'bg-red-600 text-white hover:bg-red-700'
        } disabled:opacity-50`}
      >
        {actionLoading ? 'Loading...' : isSubscribed ? '✓ Subscribed' : 'Subscribe'}
      </button>
      {subscriberCount > 0 && (
        <div className="text-sm text-gray-600">
          <span className="font-semibold">{subscriberCount.toLocaleString()}</span>{' '}
          {subscriberCount === 1 ? 'subscriber' : 'subscribers'}
        </div>
      )}
    </div>
  );
}

