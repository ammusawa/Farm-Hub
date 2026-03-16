'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { LockClosedIcon } from '@heroicons/react/24/solid';
import CommentsSection from '@/app/components/CommentsSection';
import RatingSection from '@/app/components/RatingSection';
import VideoPlayer from '@/app/components/VideoPlayer';
import SubscribeButton from '@/app/components/SubscribeButton';
import VideoTranslator from '@/app/components/VideoTranslator';
import SuggestedVideos from '@/app/components/SuggestedVideos';
import TranscriptDisplay from '@/app/components/TranscriptDisplay';
import ConfirmationModal from '@/app/components/ConfirmationModal';
import { useLanguage } from '@/app/contexts/LanguageContext';

interface Content {
  id: number;
  title: string;
  body: string;
  language: string;
  cropType: string;
  contentType: string;
  authorName: string;
  authorId: number;
  avgRating: number;
  ratingCount: number;
  createdAt: string;
  videoFile?: string | null;
  videoDuration?: number | null;
  videoSize?: number | null;
  videoFormat?: string | null;
  videoResolution?: string | null;
  isPremium?: boolean;
  isLocked?: boolean;
  teaserLength?: number;
  wasTranslated?: boolean;
  originalLanguage?: string;
  translatedToLanguage?: string;
}

export default function ContentPage() {
  const params = useParams();
  const router = useRouter();
  const { language, t } = useLanguage();

  const [content, setContent] = useState<Content | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [selectedTranscriptLanguage, setSelectedTranscriptLanguage] = useState<string | null>(null);
  const [availableTranscriptLanguages, setAvailableTranscriptLanguages] = useState<string[]>([]);
  const [originalTranscriptLanguage, setOriginalTranscriptLanguage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [previousLanguage, setPreviousLanguage] = useState<string>(language);

  // Load content
  useEffect(() => {
    const loadContent = async () => {
      if (previousLanguage !== language && content && language !== 'default') {
        setTranslating(true);
      }

      if (!content) {
        setLoading(true);
      }

      try {
        const translateParam = language !== 'default' ? `?translate=${language}` : '';
        const res = await fetch(`/api/content/${params.id}${translateParam}`);
        if (!res.ok) {
          throw new Error('Failed to fetch content');
        }
        const data = await res.json();
        if (data.content) {
          console.log('Content loaded:', data.content);
          setContent(data.content);
          setPreviousLanguage(language);
        }
      } catch (error) {
        console.error('Failed to load content:', error);
      } finally {
        setLoading(false);
        setTranslating(false);
      }
    };

    loadContent();
  }, [params.id, language, content]);

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
  }, []);

  // Initialize transcript language when content loads
  useEffect(() => {
    if (content?.contentType === 'video' && content.id) {
      const initializeTranscriptLanguage = async () => {
        try {
          const res = await fetch(`/api/video/transcript/${content.id}/languages`);
          if (res.ok) {
            const data = await res.json();
            const available = data.languages || [];
            const original = data.originalLanguage || (available.length > 0 ? available[0] : null);

            setAvailableTranscriptLanguages(available);
            setOriginalTranscriptLanguage(original);

            // Set initial transcript language
            if (!selectedTranscriptLanguage) {
              if (language !== 'default' && available.includes(language)) {
                setSelectedTranscriptLanguage(language);
              } else if (original) {
                setSelectedTranscriptLanguage(original);
              } else if (available.length > 0) {
                setSelectedTranscriptLanguage(available[0]);
              }
            }
          }
        } catch (error) {
          console.error('Failed to load transcript languages:', error);
        }
      };

      initializeTranscriptLanguage();
    }
  }, [content?.id, content?.contentType, language, selectedTranscriptLanguage]);

  // Sync transcript language with global language change
  useEffect(() => {
    if (
      content?.contentType === 'video' &&
      availableTranscriptLanguages.length > 0 &&
      originalTranscriptLanguage
    ) {
      if (language !== 'default' && availableTranscriptLanguages.includes(language)) {
        if (selectedTranscriptLanguage !== language) {
          setSelectedTranscriptLanguage(language);
        }
      } else if (language === 'default' && selectedTranscriptLanguage !== originalTranscriptLanguage) {
        setSelectedTranscriptLanguage(originalTranscriptLanguage);
      }
    }
  }, [language, availableTranscriptLanguages, originalTranscriptLanguage, content?.contentType]);

  if (loading && !content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-700">Loading content...</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Content Not Found</h1>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <button
        onClick={() => router.back()}
        className="mb-6 inline-flex items-center text-green-600 hover:text-green-800 font-medium"
      >
        ← {t('content.back')}
      </button>

      {/* Translation status messages */}
      {translating && language !== 'default' && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-blue-800">
            Translating content to{' '}
            {language === 'ha' ? 'Hausa' : language === 'ig' ? 'Igbo' : language === 'yo' ? 'Yoruba' : 'English'}...
          </span>
        </div>
      )}

      {content.wasTranslated && !translating && language !== 'default' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <span className="text-green-600 text-xl">✓</span>
          <span className="text-green-800">
            Content translated from{' '}
            {content.originalLanguage === 'en'
              ? 'English'
              : content.originalLanguage === 'ha'
              ? 'Hausa'
              : content.originalLanguage === 'ig'
              ? 'Igbo'
              : content.originalLanguage === 'yo'
              ? 'Yoruba'
              : content.originalLanguage || 'original'}{' '}
            to{' '}
            {content.translatedToLanguage === 'en'
              ? 'English'
              : content.translatedToLanguage === 'ha'
              ? 'Hausa'
              : content.translatedToLanguage === 'ig'
              ? 'Igbo'
              : content.translatedToLanguage === 'yo'
              ? 'Yoruba'
              : content.translatedToLanguage || 'current language'}
          </span>
        </div>
      )}

      {language === 'default' && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
          <span className="text-gray-600 text-xl">ℹ</span>
          <span className="text-gray-800">
            Showing content in original language:{' '}
            {content.language === 'en'
              ? 'English'
              : content.language === 'ha'
              ? 'Hausa'
              : content.language === 'ig'
              ? 'Igbo'
              : content.language === 'yo'
              ? 'Yoruba'
              : content.language || 'Unknown'}
          </span>
        </div>
      )}

      {/* Premium Lock Overlay */}
      {content.isLocked ? (
        <div className="relative bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Blurred teaser content */}
          <div className="blur-md pointer-events-none p-8">
            <div className="flex items-start justify-between mb-6">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{content.title}</h1>
              <div className="flex gap-3">
                <span className="px-4 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  {content.contentType}
                </span>
                {content.cropType && (
                  <span className="px-4 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                    {content.cropType}
                  </span>
                )}
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-6">
              By{' '}
              {content.authorId ? (
                <Link
                  href={`/?authorId=${content.authorId}&authorName=${encodeURIComponent(content.authorName)}`}
                  className="text-green-600 hover:underline"
                >
                  {content.authorName}
                </Link>
              ) : (
                content.authorName
              )}{' '}
              • {new Date(content.createdAt).toLocaleDateString()}
            </div>

            <div className="prose max-w-none">
              <p className="text-gray-700">{content.body}</p>
            </div>
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent flex items-center justify-center">
            <div className="text-center text-white px-6 max-w-2xl">
              <LockClosedIcon className="h-20 w-20 mx-auto mb-6 text-yellow-400" />
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Premium Content</h2>
              <p className="text-lg md:text-xl mb-8 opacity-90">
                This is exclusive premium content. Subscribe to unlock the full article, video, and resources.
              </p>
              <Link
                href="/subscriptions"
                className="inline-block bg-yellow-500 text-black px-10 py-4 rounded-xl font-bold text-lg hover:bg-yellow-400 transition shadow-lg"
              >
                Upgrade Now
              </Link>
              <p className="mt-6 text-sm opacity-80">
                Already subscribed? <Link href="/login" className="underline hover:text-yellow-300">Log in</Link>
              </p>
            </div>
          </div>
        </div>
      ) : (
        // Full content for subscribed users or non-premium
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-10">
          <div className="flex items-start justify-between mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{content.title}</h1>
            <div className="flex gap-3">
              <span className="px-4 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                {content.contentType}
              </span>
              {content.cropType && (
                <span className="px-4 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                  {content.cropType}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-8 text-sm text-gray-600">
            <div>
              By{' '}
              {content.authorId ? (
                <Link
                  href={`/?authorId=${content.authorId}&authorName=${encodeURIComponent(content.authorName)}`}
                  className="text-green-600 hover:underline font-medium"
                >
                  {content.authorName}
                </Link>
              ) : (
                content.authorName
              )}{' '}
              • {new Date(content.createdAt).toLocaleDateString()}
            </div>

            {user && user.id !== content.authorId && (
              <SubscribeButton professionalId={content.authorId} variant="compact" />
            )}
          </div>

          {/* Video Player */}
          {content.contentType === 'video' && (
            <div className="mb-10">
              {content.videoFile ? (
                <div className="w-full">
                  <VideoPlayer
                    src={content.videoFile}
                    title={content.title}
                    contentId={content.id}
                    selectedTranscriptLanguage={selectedTranscriptLanguage}
                    onLanguageChange={(lang) => setSelectedTranscriptLanguage(lang)}
                  />
                  <VideoTranslator contentId={content.id} />
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                  <p className="text-yellow-800 text-lg">
                    ⚠️ Video file is missing or failed to load
                  </p>
                </div>
              )}

              {content.videoDuration && (
                <div className="mt-6 bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Video Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-gray-700">
                    <div>
                      <span className="font-medium">Duration:</span>{' '}
                      {Math.floor(content.videoDuration / 60)}:
                      {Math.floor(content.videoDuration % 60).toString().padStart(2, '0')}
                    </div>
                    {content.videoSize && (
                      <div>
                        <span className="font-medium">Size:</span>{' '}
                        {(content.videoSize / (1024 * 1024)).toFixed(2)} MB
                      </div>
                    )}
                    {content.videoFormat && (
                      <div>
                        <span className="font-medium">Format:</span> {content.videoFormat.toUpperCase()}
                      </div>
                    )}
                    {content.videoResolution && (
                      <div>
                        <span className="font-medium">Resolution:</span> {content.videoResolution}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {content.videoFile && selectedTranscriptLanguage && (
                <TranscriptDisplay
                  key={`transcript-${content.id}-${selectedTranscriptLanguage}`}
                  contentId={content.id}
                  selectedLanguage={selectedTranscriptLanguage}
                  onLanguageChange={(lang) => setSelectedTranscriptLanguage(lang)}
                  availableLanguages={availableTranscriptLanguages}
                  originalLanguage={originalTranscriptLanguage || undefined}
                />
              )}
            </div>
          )}

          {/* Main Content Body */}
          <div className="prose prose-lg max-w-none mb-10">
            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{content.body}</p>
          </div>

          {/* Author Actions */}
          {user && user.id === content.authorId && (
            <div className="flex flex-wrap gap-4 mb-10">
              <Link
                href={`/content/${content.id}/edit`}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
              >
                Edit Content
              </Link>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition"
              >
                Delete Content
              </button>
            </div>
          )}

          {/* Ratings & Comments */}
          <RatingSection contentId={content.id} user={user} />
          <CommentsSection contentId={content.id} user={user} />
        </div>
      )}

      {/* Sidebar - Suggested Content */}
      <aside className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            {content.contentType === 'video'
              ? t('content.suggestedVideos')
              : content.contentType === 'article'
              ? t('content.suggestedArticles')
              : t('content.suggestedTips')}
          </h3>
          <SuggestedVideos
            currentId={content.id}
            language={content.language}
            cropType={content.cropType}
            contentType={content.contentType}
            translateTo={language}
          />
        </div>
      </aside>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          try {
            const res = await fetch(`/api/content/${content.id}`, {
              method: 'DELETE',
              credentials: 'include',
            });
            if (res.ok) {
              router.push('/');
            } else {
              const data = await res.json();
              alert(data.error || 'Failed to delete content');
            }
          } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete content');
          }
        }}
        title="Delete Content"
        message="Are you sure you want to delete this content? This action cannot be undone. All ratings, comments, and associated data will also be deleted."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
      />
    </div>
  );
}