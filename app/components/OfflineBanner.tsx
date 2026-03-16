'use client';

import { useState, useEffect } from 'react';

export default function OfflineToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleOffline = () => {
      setVisible(true);

      // Auto-hide after 5 seconds
      timeout = setTimeout(() => {
        setVisible(false);
      }, 5000);
    };

    const handleOnline = () => {
      setVisible(false);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Initial state
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 rounded-lg bg-yellow-600 px-4 py-3 text-sm text-white shadow-lg animate-fade-in"
    >
      You are offline. Showing cached content.
    </div>
  );
}
