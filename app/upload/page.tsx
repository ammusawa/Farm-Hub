'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LockClosedIcon } from '@heroicons/react/24/solid';

export default function UploadPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    title: '',
    body: '',
    language: 'en',
    cropType: '',
    contentType: 'article' as 'article' | 'video' | 'tip',
    tags: '',
    videoFile: null as File | null,
    isPremium: false,
    premiumPrice: '',
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<{
    duration: number;
    size: number;
    format: string;
    resolution?: string;
  } | null>(null);

  const [transcript, setTranscript] = useState('');
  const [transcriptLanguage, setTranscriptLanguage] = useState('en');
  const [autoTranslate, setAutoTranslate] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        let res = await fetch('/api/auth/me', { credentials: 'include' });

        if (!res.ok) {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshRes.ok) {
            res = await fetch('/api/auth/me', { credentials: 'include' });
          } else {
            setLoading(false);
            router.push('/login');
            return;
          }
        }

        const data = await res.json();

        if (!data.user) {
          setLoading(false);
          router.push('/login');
          return;
        }

        if (data.user.role !== 'professional' || !data.user.isVerifiedProfessional) {
          setLoading(false);
          router.push('/apply-professional');
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to check user:', err);
        setLoading(false);
        router.push('/login');
      }
    };

    checkUser();
  }, [router]);

  // Clean up video preview
  useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [videoPreview]);

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    const maxSize = 1024 * 1024 * 1024; // 1GB
    if (file.size > maxSize) {
      setError('Video file exceeds 1GB limit');
      return;
    }

    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid video format. Allowed: MP4, WebM, OGG, MOV');
      return;
    }

    setFormData(prev => ({ ...prev, videoFile: file }));

    const url = URL.createObjectURL(file);
    setVideoPreview(url);

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;

    video.onloadedmetadata = () => {
      setVideoMetadata({
        duration: video.duration,
        size: file.size,
        format: file.type.split('/')[1].toUpperCase(),
        resolution: `${video.videoWidth}x${video.videoHeight}`,
      });
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // Debug: log what we're actually sending
    console.log('Submitting upload payload:', {
      title: formData.title,
      body: formData.body.substring(0, 100) + (formData.body.length > 100 ? '...' : ''),
      contentType: formData.contentType,
      isPremium: formData.isPremium,
      premiumPrice: formData.premiumPrice,
      tags: formData.tags,
      hasVideo: !!formData.videoFile,
    });

    try {
      let videoFilePath = null;
      if (formData.contentType === 'video' && formData.videoFile) {
        const videoFormData = new FormData();
        videoFormData.append('video', formData.videoFile);

        const videoRes = await fetch('/api/upload/video', {
          method: 'POST',
          credentials: 'include',
          body: videoFormData,
        });

        const videoData = await videoRes.json();
        if (!videoRes.ok) {
          setError(videoData.error || 'Failed to upload video');
          setSubmitting(false);
          return;
        }

        videoFilePath = videoData.filePath;
      }

      // Prepare payload - MAKE SURE premium fields are included!
      const contentData: any = {
        title: formData.title.trim(),
        body: formData.body.trim(),
        language: formData.language,
        cropType: formData.cropType.trim() || null,
        contentType: formData.contentType,
        tags: formData.tags.trim(),
        isPremium: formData.isPremium,                          // ← Critical fix
        premiumPrice: formData.premiumPrice 
          ? Number(formData.premiumPrice) 
          : null,                                               // ← Critical fix
      };

      if (videoFilePath) {
        contentData.videoFile = videoFilePath;
        if (videoMetadata) {
          contentData.videoDuration = Math.floor(videoMetadata.duration);
          contentData.videoSize = videoMetadata.size;
          contentData.videoFormat = videoMetadata.format.toLowerCase();
          contentData.videoResolution = videoMetadata.resolution;
        }
      }

      // Final payload log before sending
      console.log('Final payload to /api/content:', contentData);

      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(contentData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to upload content');
        setSubmitting(false);
        return;
      }

      // Transcript handling (unchanged)
      if (formData.contentType === 'video' && transcript.trim() && data.content?.id) {
        try {
          const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
          const subtitles = sentences.map((sentence, index) => {
            const duration = videoMetadata?.duration || 60;
            const segmentDuration = duration / sentences.length;
            return {
              start: index * segmentDuration,
              end: (index + 1) * segmentDuration,
              text: sentence.trim(),
            };
          });

          await fetch('/api/video/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              contentId: data.content.id,
              language: transcriptLanguage,
              transcript: transcript,
              subtitles,
            }),
          });

          if (autoTranslate) {
            const languages = ['en', 'ha', 'ig', 'yo'].filter(l => l !== transcriptLanguage);
            for (const lang of languages) {
              try {
                await fetch('/api/video/translate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    contentId: data.content.id,
                    sourceLanguage: transcriptLanguage,
                    targetLanguage: lang,
                  }),
                });
              } catch (err) {
                console.error(`Translation to ${lang} failed:`, err);
              }
            }
          }
        } catch (err) {
          console.error('Transcript handling failed:', err);
          // Don't block upload success
        }
      }

      router.push(`/content/${data.content.id}`);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center py-12">
          <div className="text-lg text-gray-900">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Upload New Content</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="e.g., Best Maize Planting Techniques for Northern Nigeria"
          />
        </div>

        {/* Content Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content Type *
          </label>
          <select
            value={formData.contentType}
            onChange={(e) => {
              const type = e.target.value as 'article' | 'video' | 'tip';
              setFormData(prev => ({
                ...prev,
                contentType: type,
                videoFile: type !== 'video' ? null : prev.videoFile,
              }));
              if (type !== 'video' && videoPreview) {
                URL.revokeObjectURL(videoPreview);
                setVideoPreview(null);
                setVideoMetadata(null);
              }
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="article">Article / Guide</option>
            <option value="video">Video</option>
            <option value="tip">Quick Tip</option>
          </select>
        </div>

        {/* PREMIUM TOGGLE - with debug display */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-1">
              <LockClosedIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-3 flex-1">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isPremium}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    isPremium: e.target.checked,
                  }))}
                  className="h-5 w-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                />
                <span className="ml-2 text-lg font-semibold text-yellow-800">
                  Make this content Premium (paid subscribers only)
                </span>
              </label>

              {/* Debug: show current state */}
              <div className="mt-1 text-sm text-yellow-700">
                Current state: <strong>{formData.isPremium ? 'PREMIUM ENABLED' : 'FREE'}</strong>
              </div>

              <p className="mt-2 text-sm text-yellow-700">
                Premium content is only visible to users with an active subscription. 
                Great for in-depth guides, exclusive videos, detailed farm plans, etc.
              </p>

              {formData.isPremium && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-yellow-800 mb-1">
                    Optional: Price per unlock (₦) – leave blank for subscription-only access
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.premiumPrice}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      premiumPrice: e.target.value,
                    }))}
                    placeholder="e.g., 500"
                    className="w-full md:w-1/3 px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                  />
                  <p className="mt-1 text-xs text-yellow-700">
                    If set, users can pay once to unlock this specific content (micro-payment).
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Video Upload + Transcript */}
        {formData.contentType === 'video' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Video File *
              </label>
              <input
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime"
                onChange={handleVideoChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Max 1GB. Supported: MP4, WebM, OGG, MOV
              </p>
            </div>

            {/* Transcript */}
            <div className="bg-gray-50 p-5 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Video Transcript (recommended)
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Add transcript for better accessibility and auto-translation to Hausa, Igbo, Yoruba.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transcript Language
                  </label>
                  <select
                    value={transcriptLanguage}
                    onChange={(e) => setTranscriptLanguage(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="en">English</option>
                    <option value="ha">Hausa</option>
                    <option value="ig">Igbo</option>
                    <option value="yo">Yoruba</option>
                  </select>
                </div>

                <div className="flex items-center self-end">
                  <input
                    type="checkbox"
                    id="autoTranslate"
                    checked={autoTranslate}
                    onChange={(e) => setAutoTranslate(e.target.checked)}
                    className="h-5 w-5 text-green-600 border-gray-300 rounded"
                  />
                  <label htmlFor="autoTranslate" className="ml-2 text-sm text-gray-700">
                    Auto-translate to other languages
                  </label>
                </div>
              </div>

              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste or type the full transcript here..."
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {videoPreview && (
              <div className="space-y-4">
                <video
                  src={videoPreview}
                  controls
                  className="w-full rounded-lg shadow-sm"
                  style={{ maxHeight: '400px' }}
                />
                {videoMetadata && (
                  <div className="bg-gray-50 p-4 rounded-lg text-sm grid grid-cols-2 gap-3">
                    <div><strong>Duration:</strong> {Math.floor(videoMetadata.duration / 60)}:{Math.floor(videoMetadata.duration % 60).toString().padStart(2, '0')}</div>
                    <div><strong>Size:</strong> {(videoMetadata.size / (1024 * 1024)).toFixed(2)} MB</div>
                    <div><strong>Format:</strong> {videoMetadata.format}</div>
                    {videoMetadata.resolution && <div><strong>Resolution:</strong> {videoMetadata.resolution}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {formData.contentType === 'video' ? 'Description / Summary *' : 'Content Body *'}
          </label>
          <textarea
            required
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            rows={formData.contentType === 'video' ? 6 : 12}
            placeholder={
              formData.contentType === 'video'
                ? 'Write a summary or description of your video...'
                : 'Write your full article, tip, or guide here...'
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Language & Crop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="en">English</option>
              <option value="ha">Hausa</option>
              <option value="ig">Igbo</option>
              <option value="yo">Yoruba</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Crop Type
            </label>
            <select
              value={formData.cropType}
              onChange={(e) => setFormData({ ...formData, cropType: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select crop...</option>
              <option value="maize">Maize</option>
              <option value="rice">Rice</option>
              <option value="tomato">Tomato</option>
              <option value="cassava">Cassava</option>
              <option value="yam">Yam</option>
              <option value="beans">Beans</option>
              <option value="sorghum">Sorghum</option>
              <option value="millet">Millet</option>
              <option value="others">Others</option>
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="e.g., planting, fertilizer, irrigation, northern nigeria"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Submit */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-60 transition disabled:cursor-not-allowed"
          >
            {submitting ? 'Uploading...' : 'Publish Content'}
          </button>
        </div>
      </form>
    </div>
  );
}