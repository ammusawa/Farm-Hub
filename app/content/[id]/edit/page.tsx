'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ConfirmationModal from '@/app/components/ConfirmationModal';

interface Content {
  id: number;
  title: string;
  body: string;
  language: string;
  cropType: string;
  contentType: string;
  tags: string;
  authorId: number;
  videoFile?: string | null;
  videoDuration?: number | null;
  videoSize?: number | null;
  videoFormat?: string | null;
  videoResolution?: string | null;
}

export default function EditContentPage() {
  const params = useParams();
  const router = useRouter();
  const [content, setContent] = useState<Content | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [removeVideo, setRemoveVideo] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    body: '',
    language: 'en',
    cropType: '',
    contentType: 'article',
    tags: '',
    videoFile: null as File | null,
  });

  const [videoMetadata, setVideoMetadata] = useState<{
    duration: number;
    size: number;
    format: string;
    resolution?: string;
  } | null>(null);
  const [transcript, setTranscript] = useState('');
  const [transcriptLanguage, setTranscriptLanguage] = useState('en');
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    loadContent();
    loadUser();
  }, [params.id]);

  // Clean up video preview URL on unmount
  useEffect(() => {
    return () => {
      if (videoPreview) {
        URL.revokeObjectURL(videoPreview);
      }
    };
  }, [videoPreview]);

  const loadContent = async () => {
    try {
      const res = await fetch(`/api/content/${params.id}`);
      const data = await res.json();
      if (data.content) {
        setContent(data.content);
        setFormData({
          title: data.content.title || '',
          body: data.content.body || '',
          language: data.content.language || 'en',
          cropType: data.content.cropType || '',
          contentType: data.content.contentType || 'article',
          tags: data.content.tags || '',
          videoFile: null,
        });

        // If there's an existing video, show it
        if (data.content.videoFile) {
          setVideoPreview(data.content.videoFile);
          if (data.content.videoDuration) {
            setVideoMetadata({
              duration: data.content.videoDuration,
              size: data.content.videoSize || 0,
              format: data.content.videoFormat || 'MP4',
              resolution: data.content.videoResolution || undefined,
            });
          }
        }

        // Load existing transcript if available
        try {
          const transcriptRes = await fetch(`/api/video/transcript/${params.id}/languages`);
          if (transcriptRes.ok) {
            const transcriptData = await transcriptRes.json();
            if (transcriptData.languages && transcriptData.languages.length > 0) {
              const lang = transcriptData.languages[0];
              const langRes = await fetch(`/api/video/transcript/${params.id}?language=${lang}`);
              if (langRes.ok) {
                const langData = await langRes.json();
                if (langData.transcript) {
                  setTranscript(langData.transcript);
                  setTranscriptLanguage(lang);
                }
              }
            }
          }
        } catch (err) {
          // No transcript found, that's okay
        }
      }
    } catch (error) {
      console.error('Failed to load content:', error);
      setError('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.user) setUser(data.user);
    } catch (error) {
      // Not logged in
    }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      // Validate video file
      const maxSize = 1024 * 1024 * 1024; // 1GB
      if (file.size > maxSize) {
        setError('Video file exceeds 1GB limit');
        return;
      }

      const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid video format. Allowed: MP4, WebM, OGG, MOV, AVI');
        return;
      }

      setFormData({ ...formData, videoFile: file });
      setRemoveVideo(false); // If uploading new video, don't remove
      
      // Create preview and extract metadata
      const url = URL.createObjectURL(file);
      setVideoPreview(url);

      // Extract video metadata
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
    }
  };

  const handleRemoveVideo = () => {
    setRemoveVideo(true);
    setFormData({ ...formData, videoFile: null });
    if (videoPreview && videoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoPreview(null);
    setVideoMetadata(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Check if user is the author
      if (!user || user.id !== content?.authorId) {
        setError('You are not authorized to edit this content');
        setSubmitting(false);
        return;
      }

      // If video content type and new video file provided, upload video first
      let videoFilePath = null;
      let videoMeta = null;

      if (formData.contentType === 'video') {
        if (removeVideo) {
          // Remove video - set to null
          videoFilePath = null;
          videoMeta = {
            videoFile: null,
            videoDuration: null,
            videoSize: null,
            videoFormat: null,
            videoResolution: null,
          };
        } else if (formData.videoFile) {
          // Upload new video
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
          if (videoMetadata) {
            videoMeta = {
              videoFile: videoFilePath,
              videoDuration: Math.floor(videoMetadata.duration),
              videoSize: videoMetadata.size,
              videoFormat: videoMetadata.format.toLowerCase(),
              videoResolution: videoMetadata.resolution,
            };
          }
        } else if (content?.videoFile) {
          // Keep existing video
          videoFilePath = content.videoFile;
          videoMeta = {
            videoFile: content.videoFile,
            videoDuration: content.videoDuration || null,
            videoSize: content.videoSize || null,
            videoFormat: content.videoFormat || null,
            videoResolution: content.videoResolution || null,
          };
        } else {
          // Video content type but no video - this is an error
          setError('Video file is required for video content');
          setSubmitting(false);
          return;
        }
      }

      // Update content
      const updateData: any = {
        title: formData.title,
        body: formData.body,
        language: formData.language,
        cropType: formData.cropType,
        contentType: formData.contentType,
        tags: formData.tags,
      };

      // Include video metadata if available
      if (videoMeta) {
        Object.assign(updateData, videoMeta);
      }

      const res = await fetch(`/api/content/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update content');
        return;
      }

      // If video and transcript provided, save transcript
      if (formData.contentType === 'video' && transcript.trim() && !removeVideo) {
        try {
          // Create simple subtitles from transcript
          const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
          const duration = videoMetadata?.duration || content?.videoDuration || 60;
          const subtitles = sentences.map((sentence, index) => {
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
              contentId: parseInt(params.id as string),
              language: transcriptLanguage,
              transcript: transcript,
              subtitles: subtitles,
            }),
          });

          // Auto-translate to other languages if enabled
          if (autoTranslate) {
            const languages = ['en', 'ha', 'ig', 'yo'].filter(lang => lang !== transcriptLanguage);
            for (const lang of languages) {
              try {
                await fetch('/api/video/translate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    contentId: parseInt(params.id as string),
                    sourceLanguage: transcriptLanguage,
                    targetLanguage: lang,
                  }),
                });
              } catch (err) {
                console.error(`Failed to translate to ${lang}:`, err);
              }
            }
          }
        } catch (err) {
          console.error('Failed to save transcript:', err);
          // Don't fail the update if transcript fails
        }
      }

      // Redirect to the content page
      router.push(`/content/${params.id}`);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="text-lg text-gray-900">Loading...</div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Content not found</h1>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg"
        >
          Go Home
        </button>
      </div>
    );
  }

  if (user && user.id !== content.authorId) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Unauthorized</h1>
        <p className="text-gray-600 mb-4">You are not authorized to edit this content.</p>
        <button
          onClick={() => router.push(`/content/${params.id}`)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <button
        onClick={() => router.push(`/content/${params.id}`)}
        className="mb-4 text-primary-600 hover:text-primary-700"
      >
        ← Back to Content
      </button>

      <h1 className="text-3xl font-bold mb-6">Edit Content</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-4">
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
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content *
          </label>
          <textarea
            required
            rows={10}
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Language *
          </label>
          <select
            required
            value={formData.language}
            onChange={(e) => setFormData({ ...formData, language: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          <input
            type="text"
            value={formData.cropType}
            onChange={(e) => setFormData({ ...formData, cropType: e.target.value })}
            placeholder="e.g., Maize, Rice, Cassava"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content Type *
          </label>
          <select
            required
            value={formData.contentType}
            onChange={(e) => {
              setFormData({ ...formData, contentType: e.target.value as 'article' | 'video' | 'tip' });
              // Clear video file when switching away from video
              if (e.target.value !== 'video') {
                setFormData(prev => ({ ...prev, videoFile: null }));
                setRemoveVideo(false);
                if (videoPreview && videoPreview.startsWith('blob:')) {
                  URL.revokeObjectURL(videoPreview);
                }
                setVideoPreview(null);
                setVideoMetadata(null);
              }
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="article">Article</option>
            <option value="video">Video</option>
            <option value="tip">Tip</option>
          </select>
        </div>

        {formData.contentType === 'video' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Video File {!content.videoFile && !formData.videoFile ? '*' : ''}
            </label>
            
            {content.videoFile && !removeVideo && !formData.videoFile && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">
                  Current video: {content.videoFile.split('/').pop()}
                </p>
                <button
                  type="button"
                  onClick={handleRemoveVideo}
                  className="text-sm text-red-600 hover:text-red-700 underline"
                >
                  Remove current video
                </button>
              </div>
            )}

            <input
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo"
              onChange={handleVideoChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Maximum file size: 1GB. Supported formats: MP4, WebM, OGG, MOV, AVI
              {content.videoFile && !removeVideo && ' (Leave empty to keep current video)'}
            </p>

            {videoPreview && (
              <div className="mt-4 space-y-3">
                <video
                  src={videoPreview}
                  controls
                  className="w-full max-w-md rounded-lg"
                  style={{ maxHeight: '400px' }}
                >
                  Your browser does not support the video tag.
                </video>
                
                {videoMetadata && (
                  <div className="bg-gray-50 rounded-lg p-4 text-sm">
                    <h4 className="font-semibold text-gray-700 mb-2">Video Information</h4>
                    <div className="grid grid-cols-2 gap-2 text-gray-600">
                      <div>
                        <span className="font-medium">Duration:</span>{' '}
                        {Math.floor(videoMetadata.duration / 60)}:
                        {Math.floor(videoMetadata.duration % 60).toString().padStart(2, '0')}
                      </div>
                      <div>
                        <span className="font-medium">Size:</span>{' '}
                        {(videoMetadata.size / (1024 * 1024)).toFixed(2)} MB
                      </div>
                      <div>
                        <span className="font-medium">Format:</span> {videoMetadata.format}
                      </div>
                      {videoMetadata.resolution && (
                        <div>
                          <span className="font-medium">Resolution:</span> {videoMetadata.resolution}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Transcript Section */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Video Transcript (Optional)
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                Add or update a transcript to enable automatic translation and subtitles in multiple languages.
              </p>
              
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transcript Language
                </label>
                <select
                  value={transcriptLanguage}
                  onChange={(e) => setTranscriptLanguage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="en">English</option>
                  <option value="ha">Hausa</option>
                  <option value="ig">Igbo</option>
                  <option value="yo">Yoruba</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transcript Text
                </label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste or type the video transcript here. It will be automatically translated to other languages."
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoTranslate"
                  checked={autoTranslate}
                  onChange={(e) => setAutoTranslate(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="autoTranslate" className="text-sm text-gray-700">
                  Automatically translate to other languages (Hausa, Igbo, Yoruba)
                </label>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="Comma-separated tags"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Updating...' : 'Update Content'}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/content/${params.id}`)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </form>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          try {
            const res = await fetch(`/api/content/${params.id}`, {
              method: 'DELETE',
              credentials: 'include',
            });
            const data = await res.json();
            if (res.ok) {
              router.push('/');
            } else {
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
