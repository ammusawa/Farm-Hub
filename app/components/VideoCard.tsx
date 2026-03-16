'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import SubscribeButton from './SubscribeButton';
import VideoPlayer from './VideoPlayer';
import RatingSection from './RatingSection';
import CommentsSection from './CommentsSection';
import VideoTranslator from './VideoTranslator';

interface VideoCardProps {
  id: number;
  title: string;
  body: string;
  videoFile: string;
  authorName: string;
  authorId: number;
  avgRating: number;
  ratingCount: number;
  createdAt: string;
  videoDuration?: number | null;
  cropType?: string | null;
  currentUserId?: number | null;
}

export default function VideoCard({
  id,
  title,
  body,
  videoFile,
  authorName,
  authorId,
  avgRating,
  ratingCount,
  createdAt,
  videoDuration,
  cropType,
  currentUserId,
}: VideoCardProps) {
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [userReaction, setUserReaction] = useState<'like' | 'dislike' | null>(null);
  const [loadingReaction, setLoadingReaction] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const authorProfileHref = authorId
    ? `/?authorId=${authorId}&authorName=${encodeURIComponent(authorName)}`
    : null;

  // Load user data for comments and ratings
  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      } catch (error) {
        // Not logged in
      }
    };
    loadUser();
  }, []);

  // Load likes/dislikes
  useEffect(() => {
    const loadLikes = async () => {
      try {
        const res = await fetch(`/api/likes?contentId=${id}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setLikes(data.likes || 0);
          setDislikes(data.dislikes || 0);
          setUserReaction(data.userReaction || null);
        }
      } catch (error) {
        console.error('Failed to load likes:', error);
      }
    };
    loadLikes();
  }, [id]);

  const handleLike = async (type: 'like' | 'dislike') => {
    if (!user) {
      alert('Please login to like/dislike content');
      return;
    }

    if (loadingReaction) return;
    setLoadingReaction(true);

    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contentId: id, type }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Reload likes/dislikes to get updated counts
        const likesRes = await fetch(`/api/likes?contentId=${id}`, {
          credentials: 'include',
        });
        if (likesRes.ok) {
          const likesData = await likesRes.json();
          setLikes(likesData.likes || 0);
          setDislikes(likesData.dislikes || 0);
          setUserReaction(likesData.userReaction || null);
        }
      }
    } catch (error) {
      console.error('Failed to update like/dislike:', error);
    } finally {
      setLoadingReaction(false);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video && !thumbnailLoaded) {
      video.addEventListener('loadeddata', () => {
        // Seek to 1 second for thumbnail
        video.currentTime = 1;
        setThumbnailLoaded(true);
      });
    }
  }, [thumbnailLoaded]);


  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPlaying(true);
  };

  const handleCloseModal = () => {
    setIsPlaying(false);
  };

  // Close modal on Escape key and prevent body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPlaying) {
        handleCloseModal();
      }
    };
    
    if (isPlaying) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    } else {
      // Restore body scroll when modal is closed
      document.body.style.overflow = '';
    }
    
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isPlaying]);

  return (
    <>
      <div
        className="block group cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
      <div className="w-full">
        {/* Thumbnail Container */}
        <div className="relative w-full bg-black rounded-lg overflow-hidden aspect-video mb-3">
          <video
            ref={videoRef}
            src={videoFile}
            className="w-full h-full object-cover"
            muted
            playsInline
            preload="metadata"
            onMouseEnter={(e) => {
              if (isHovered) {
                e.currentTarget.play().catch(() => {});
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.pause();
              e.currentTarget.currentTime = 1;
            }}
          />
          
          {/* Duration Badge */}
          {videoDuration && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-semibold px-1.5 py-0.5 rounded">
              {formatDuration(videoDuration)}
            </div>
          )}

          {/* Play Button Overlay */}
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors cursor-pointer"
            onClick={handlePlayClick}
          >
            <div className="w-16 h-16 bg-white/95 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110 transform transition-transform">
              <svg className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Video Info */}
        <div className="flex gap-3">
          {/* Channel Avatar Placeholder */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm">
            {authorName.charAt(0).toUpperCase()}
          </div>

          {/* Title and Metadata */}
          <div className="flex-1 min-w-0">
            <Link href={`/content/${id}`}>
              <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1 group-hover:text-primary-600 transition-colors">
                {title}
              </h3>
            </Link>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-gray-600">
                {authorProfileHref ? (
                  <Link
                    href={authorProfileHref}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {authorName}
                  </Link>
                ) : (
                  authorName
                )}
              </p>
              {currentUserId && currentUserId !== authorId && (
                <SubscribeButton professionalId={authorId} variant="compact" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {ratingCount > 0 && (
                <span>
                  ⭐ {parseFloat(avgRating.toString()).toFixed(1)} ({ratingCount})
                </span>
              )}
              <span>•</span>
              <span>{formatDate(createdAt)}</span>
              {cropType && (
                <>
                  <span>•</span>
                  <span className="capitalize">{cropType}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* YouTube-style Modal Player */}
      {isPlaying && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={handleCloseModal}
        >
        <div 
          className="relative w-full max-w-5xl bg-black rounded-lg overflow-hidden my-auto max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
            {/* Close Button */}
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Video Player */}
            <div className="w-full aspect-video bg-black relative">
              <VideoPlayer
                src={videoFile}
                title={title}
                contentId={id}
                autoPlay={true}
                showControls={true}
              />
              <VideoTranslator contentId={id} />
            </div>

            {/* Video Info Below Player */}
            <div className="bg-gray-900 text-white p-6">
              <h2 className="text-xl font-semibold mb-4">{title}</h2>
              
              {/* Like/Dislike Buttons */}
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-700">
                <button
                  onClick={() => handleLike('like')}
                  disabled={loadingReaction}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                    userReaction === 'like'
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  } ${loadingReaction ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg 
                    className={`w-5 h-5 ${userReaction === 'like' ? 'fill-white' : 'fill-none'}`} 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v5m7 10h-2a2 2 0 01-2-2v-5a2 2 0 012-2h2a2 2 0 012 2v5a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">{likes}</span>
                </button>
                <button
                  onClick={() => handleLike('dislike')}
                  disabled={loadingReaction}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                    userReaction === 'dislike'
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  } ${loadingReaction ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg 
                    className={`w-5 h-5 ${userReaction === 'dislike' ? 'fill-white' : 'fill-none'}`} 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                    style={{ transform: 'rotate(180deg)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v5m7 10h-2a2 2 0 01-2-2v-5a2 2 0 012-2h2a2 2 0 012 2v5a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">{dislikes}</span>
                </button>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                      {authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {authorProfileHref ? (
                          <Link
                            href={authorProfileHref}
                            className="text-primary-300 hover:text-primary-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {authorName}
                          </Link>
                        ) : (
                          authorName
                        )}
                      </p>
                      {ratingCount > 0 && (
                        <p className="text-xs text-gray-400">
                          ⭐ {parseFloat(avgRating.toString()).toFixed(1)} • {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {currentUserId && currentUserId !== authorId && (
                    <SubscribeButton professionalId={authorId} variant="compact" />
                  )}
                  <Link
                    href={`/content/${id}`}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseModal();
                    }}
                  >
                    View Full Details
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>{formatDate(createdAt)}</span>
                {cropType && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{cropType}</span>
                  </>
                )}
                {videoDuration && (
                  <>
                    <span>•</span>
                    <span>{formatDuration(videoDuration)}</span>
                  </>
                )}
              </div>
              {body && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-gray-300 whitespace-pre-wrap">{body}</p>
                </div>
              )}
            </div>

            {/* Rating Section */}
            <div className="bg-white border-t border-gray-200">
              <RatingSection contentId={id} user={user} />
            </div>

            {/* Comments Section */}
            <div className="bg-white border-t border-gray-200">
              <CommentsSection contentId={id} user={user} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

