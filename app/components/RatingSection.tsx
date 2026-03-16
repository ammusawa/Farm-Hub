'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';

interface RatingSectionProps {
  contentId: number;
  user: any;
}

export default function RatingSection({ contentId, user }: RatingSectionProps) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);

  useEffect(() => {
    loadRatings();
  }, [contentId]);

  const loadRatings = async () => {
    try {
      const res = await fetch(`/api/ratings?contentId=${contentId}`);
      const data = await res.json();
      setAvgRating(parseFloat(data.avgRating) || 0);
      setRatingCount(data.count || 0);
    } catch (error) {
      console.error('Failed to load ratings:', error);
    }
  };

  const handleRating = async (stars: number) => {
    if (!user) {
      alert('Please login to rate content');
      return;
    }

    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, stars }),
      });

      if (res.ok) {
        setUserRating(stars);
        loadRatings();
      }
    } catch (error) {
      console.error('Failed to submit rating:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">{t('content.rateThis')}</h2>
      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRating(star)}
              className={`text-2xl ${
                star <= (userRating || avgRating)
                  ? 'text-yellow-400'
                  : 'text-gray-300'
              } hover:text-yellow-400 transition-colors`}
            >
              ⭐
            </button>
          ))}
        </div>
        {avgRating > 0 && (
          <div className="text-gray-600">
            {avgRating.toFixed(1)} ({ratingCount} {ratingCount === 1 ? t('content.rating') : t('content.ratings')})
          </div>
        )}
      </div>
    </div>
  );
}

