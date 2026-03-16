'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import VideoCard from '@/app/components/VideoCard';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { 
  Video, 
  Lightbulb, 
  FileText, 
  Star,
} from 'lucide-react';

interface Content {
  id: number;
  title: string;
  body: string;
  language: string;
  cropType: string;
  contentType: string;
  authorName: string;
  authorId?: number;
  avgRating: number;
  ratingCount: number;
  videoFile?: string | null;
  videoDuration?: number | null;
  createdAt: string;
  isPaid?: boolean;
  isLocked?: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, language } = useLanguage();

  const [content, setContent] = useState<Content[]>([]);
  const [user, setUser] = useState<any>(null);
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'my'>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'video' | 'tip' | 'article' | 'paid'>('all');
  const [languageFilterMode, setLanguageFilterMode] = useState<'auto' | 'manual'>('auto');
  const [filters, setFilters] = useState({
    language: '',
    crop: '',
    type: '',
  });
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [authorFilterId, setAuthorFilterId] = useState<number | null>(null);
  const [authorFilterName, setAuthorFilterName] = useState<string | null>(null);
  const [previousLanguage, setPreviousLanguage] = useState<string>(language);

  // Load user once
  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
  }, []);

  // Load content when filters/user/tab change
  useEffect(() => {
    if (user || viewMode === 'all' || authorFilterId) {
      loadContent();
    }
  }, [filters, viewMode, user, contentTypeFilter, authorFilterId, language]);

  const loadContent = async () => {
    if (previousLanguage !== language && content.length > 0 && language !== 'default') {
      setTranslating(true);
    }

    if (content.length === 0) {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      const applyLanguageFilter = languageFilterMode === 'manual' && filters.language;
      if (applyLanguageFilter) params.append('language', filters.language);
      if (filters.crop) params.append('crop', filters.crop);

      if (contentTypeFilter !== 'all') {
        params.append('type', contentTypeFilter);
      } else if (filters.type) {
        params.append('type', filters.type);
      }

      if (authorFilterId) {
        params.append('authorId', authorFilterId.toString());
      } else if (viewMode === 'my' && user) {
        params.append('authorId', user.id.toString());
      }

      if (language !== 'default') {
        params.append('translate', language);
      }

      const res = await fetch(`/api/content?${params}`);
      if (!res.ok) throw new Error('Failed to fetch content');

      const data = await res.json();

      const backendAccess = data.userAccess || {};
      setHasPremiumAccess(backendAccess.hasPremiumAccess || false);

      setContent(data.content || []);
      setPreviousLanguage(language);

      if (authorFilterId && !authorFilterName && data.content?.length > 0) {
        setAuthorFilterName(data.content[0].authorName);
      }
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoading(false);
      setTranslating(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadContent();
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ q: searchQuery });
      if (languageFilterMode === 'manual' && filters.language) {
        params.append('language', filters.language);
      }
      if (filters.crop) params.append('crop', filters.crop);

      if (contentTypeFilter !== 'all') {
        params.append('type', contentTypeFilter);
      } else if (filters.type) {
        params.append('type', filters.type);
      }

      if (authorFilterId) {
        params.append('authorId', authorFilterId.toString());
      } else if (viewMode === 'my' && user) {
        params.append('authorId', user.id.toString());
      }

      if (language !== 'default') params.append('translate', language);

      if (contentTypeFilter === 'paid') {
        params.append('access', 'paid');
      }

      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error('Search failed');

      const data = await res.json();
      setContent(data.results || []);
      setPreviousLanguage(language);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
      setTranslating(false);
    }
  };

  const clearAuthorFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('authorId');
    params.delete('authorName');
    setAuthorFilterId(null);
    setAuthorFilterName(null);
    const query = params.toString();
    router.push(query ? `/?${query}` : '/');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Translation Indicator */}
      {translating && language !== 'default' && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-blue-800">
            Translating content to {language === 'ha' ? 'Hausa' : language === 'ig' ? 'Igbo' : language === 'yo' ? 'Yoruba' : 'English'}...
          </span>
        </div>
      )}
      
      {/* Top Section: Search Bar and Add Content Button */}
      <div className="mb-6">
        <div className="flex flex-col items-center gap-4">
          <form onSubmit={handleSearch} className="w-full max-w-2xl">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('home.search')}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {t('home.searchButton')}
              </button>
            </div>
          </form>
          
          {user?.role === 'professional' && user.isVerifiedProfessional && (
            <Link
              href="/upload"
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium whitespace-nowrap"
            >
              {t('home.addContent')}
            </Link>
          )}
        </div>
      </div>

      {/* View Mode Tabs - Only for professionals */}
      {user && user.role === 'professional' && user.isVerifiedProfessional && (
        <div className="mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setViewMode('all');
                setContentTypeFilter('all');
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t('home.allContent')}
            </button>
            <button
              onClick={() => {
                if (authorFilterId) clearAuthorFilter();
                setViewMode('my');
                setContentTypeFilter('all');
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'my' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t('home.myContent')}
            </button>
          </div>
        </div>
      )}

      {authorFilterId && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-primary-700">
          <div>
            Viewing content from{' '}
            <span className="font-semibold">{authorFilterName || 'selected professional'}</span>
          </div>
          <button
            onClick={clearAuthorFilter}
            className="text-sm font-semibold hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Content Type Tabs */}
      <div className="mb-6">
        <div className="flex gap-2 border-b overflow-x-auto pb-1">
          <button
            onClick={() => {
              setContentTypeFilter('all');
              setFilters({ ...filters, type: '' });
            }}
            className={`px-6 py-3 font-medium transition-colors border-b-4 whitespace-nowrap min-w-[100px] text-center ${
              contentTypeFilter === 'all'
                ? 'border-primary-600 text-primary-700 font-bold bg-primary-50/50'
                : 'border-transparent text-gray-600 hover:text-primary-700 hover:border-primary-300'
            }`}
          >
            {t('home.allTypes')}
          </button>

          <button
            onClick={() => {
              setContentTypeFilter('video');
              setFilters({ ...filters, type: 'video' });
            }}
            className={`px-6 py-3 font-medium transition-colors border-b-4 flex items-center gap-2 whitespace-nowrap min-w-[120px] justify-center ${
              contentTypeFilter === 'video'
                ? 'border-primary-600 text-primary-700 font-bold bg-primary-50/50'
                : 'border-transparent text-gray-600 hover:text-primary-700 hover:border-primary-300'
            }`}
          >
            <Video className="h-5 w-5" />
            {t('home.videos')}
          </button>

          <button
            onClick={() => {
              setContentTypeFilter('tip');
              setFilters({ ...filters, type: 'tip' });
            }}
            className={`px-6 py-3 font-medium transition-colors border-b-4 flex items-center gap-2 whitespace-nowrap min-w-[120px] justify-center ${
              contentTypeFilter === 'tip'
                ? 'border-primary-600 text-primary-700 font-bold bg-primary-50/50'
                : 'border-transparent text-gray-600 hover:text-primary-700 hover:border-primary-300'
            }`}
          >
            <Lightbulb className="h-5 w-5" />
            {t('home.tips')}
          </button>

          <button
            onClick={() => {
              setContentTypeFilter('article');
              setFilters({ ...filters, type: 'article' });
            }}
            className={`px-6 py-3 font-medium transition-colors border-b-4 flex items-center gap-2 whitespace-nowrap min-w-[140px] justify-center ${
              contentTypeFilter === 'article'
                ? 'border-primary-600 text-primary-700 font-bold bg-primary-50/50'
                : 'border-transparent text-gray-600 hover:text-primary-700 hover:border-primary-300'
            }`}
          >
            <FileText className="h-5 w-5" />
            {t('home.articles')}
          </button>

          <button
            onClick={() => {
              setContentTypeFilter('paid');
              setFilters({ ...filters, type: '' });
            }}
            className={`px-6 py-3 font-medium transition-colors border-b-4 flex items-center gap-2 whitespace-nowrap min-w-[140px] justify-center ${
              contentTypeFilter === 'paid'
                ? 'border-amber-600 text-amber-800 font-bold bg-amber-100/70 shadow-sm'
                : 'border-transparent text-amber-700 hover:text-amber-800 hover:border-amber-400 hover:bg-amber-50/50'
            }`}
          >
            <span className="font-bold">Premium</span>
            <span className="text-xs bg-amber-500 text-white px-2.5 py-0.5 rounded-full font-semibold">
              PAID
            </span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="flex flex-col gap-2">
          <select
            value={filters.language}
            onChange={(e) => {
              const value = e.target.value;
              setFilters({ ...filters, language: value });
              setLanguageFilterMode(value ? 'manual' : 'auto');
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">{t('home.allLanguages')}</option>
            <option value="en">English</option>
            <option value="ha">Hausa</option>
            <option value="ig">Igbo</option>
            <option value="yo">Yoruba</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setLanguageFilterMode('auto');
              setFilters((prev) => ({ ...prev, language: '' }));
            }}
            disabled={languageFilterMode === 'auto' && !filters.language}
            className="self-start text-xs px-2 py-1 rounded border border-primary-200 text-primary-700 hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('home.matchLanguage')}
          </button>
        </div>

        <select
          value={filters.crop}
          onChange={(e) => setFilters({ ...filters, crop: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('home.allCrops')}</option>
          <option value="maize">{t('crop.maize')}</option>
          <option value="rice">{t('crop.rice')}</option>
          <option value="tomato">{t('crop.tomato')}</option>
          <option value="cassava">{t('crop.cassava')}</option>
          <option value="yam">{t('crop.yam')}</option>
          <option value="beans">{t('crop.beans')}</option>
          <option value="sorghum">{t('crop.sorghum')}</option>
          <option value="millet">{t('crop.millet')}</option>
          <option value="others">{t('crop.others')}</option>
        </select>

        <select
          value={filters.type}
          onChange={(e) => {
            setFilters({ ...filters, type: e.target.value });
            if (e.target.value) {
              setContentTypeFilter(e.target.value as 'video' | 'tip' | 'article');
            } else {
              setContentTypeFilter('all');
            }
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('home.allTypesFilter')}</option>
          <option value="article">{t('filter.article')}</option>
          <option value="video">{t('filter.video')}</option>
          <option value="tip">{t('filter.tip')}</option>
        </select>
      </div>

      {/* Content Grid – ALL items are now clickable */}
      {loading ? (
        <div className="text-center py-12 text-gray-900">{t('home.loading')}</div>
      ) : contentTypeFilter === 'paid' && !hasPremiumAccess ? (
        <div className="max-w-2xl mx-auto text-center py-16 px-6">
          <div className="inline-block p-6 bg-amber-50 border border-amber-200 rounded-2xl">
            <h3 className="text-2xl font-bold text-amber-800 mb-4">
              Unlock Premium Content
            </h3>
            
            <p className="text-gray-700 mb-6 leading-relaxed">
              Get access to exclusive in-depth guides, full-length professional videos, 
              advanced farming techniques and expert consultations available only to 
              subscribed members.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-center gap-3 text-left">
                <span className="text-green-600 text-xl">✓</span>
                <span>Full HD training videos in local languages</span>
              </div>
              <div className="flex items-center justify-center gap-3 text-left">
                <span className="text-green-600 text-xl">✓</span>
                <span>Detailed step-by-step guides & checklists</span>
              </div>
              <div className="flex items-center justify-center gap-3 text-left">
                <span className="text-green-600 text-xl">✓</span>
                <span>Priority support from verified agronomists</span>
              </div>
            </div>

            <Link
              href="/subscribe"
              className="inline-block px-10 py-4 bg-amber-600 text-white font-bold rounded-xl text-lg hover:bg-amber-700 transition-colors shadow-md"
            >
              Subscribe Now
            </Link>

            <p className="mt-6 text-sm text-gray-600">
              Starting from just ₦{2500}/ month
            </p>
          </div>
        </div>
      ) : content.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {viewMode === 'my' ? (
            <div>
              {contentTypeFilter !== 'all' ? (
                <p className="mb-4">{t('home.noMyContent')}</p>
              ) : (
                <p className="mb-4">{t('home.noMyContent')}</p>
              )}
              {user?.isVerifiedProfessional && (
                <Link
                  href="/upload"
                  className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {t('home.createFirst')}
                </Link>
              )}
            </div>
          ) : (
            <div>
              {contentTypeFilter !== 'all' ? (
                <p>{t('home.noContent')}</p>
              ) : (
                <p>{t('home.noContent')}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className={`grid gap-6 ${
          contentTypeFilter === 'video' 
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {content.map((item) => (
            <Link
              key={item.id}
              href={`/content/${item.id}`}
              className="group block rounded-xl overflow-hidden bg-white border border-gray-200 hover:shadow-2xl hover:border-primary-200 transition-all duration-300 cursor-pointer"
            >
              {item.contentType === 'video' && item.videoFile ? (
                <div className="relative">
                  <VideoCard
                    id={item.id}
                    title={item.title}
                    body={item.body}
                    videoFile={item.videoFile}
                    authorName={item.authorName}
                    authorId={item.authorId || 0}
                    avgRating={item.avgRating}
                    ratingCount={item.ratingCount}
                    createdAt={item.createdAt}
                    videoDuration={item.videoDuration}
                    cropType={item.cropType}
                    currentUserId={user?.id || null}
                  />
                  {/* Hover overlay for better UX */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-8">
                    <span className="text-white font-semibold text-lg px-8 py-4 bg-black/60 rounded-xl backdrop-blur-sm">
                      View Video Details
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-3">
                    <h2 className="text-xl font-bold text-gray-900 line-clamp-2 group-hover:text-primary-700 transition-colors">
                      {item.title}
                    </h2>
                    <span className="ml-3 px-3 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded-full">
                      {item.contentType}
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow">
                    {item.body.substring(0, 160)}...
                  </p>

                  <div className="flex items-center justify-between text-sm text-gray-600 mt-auto">
                    <span>
                      By{' '}
                      {item.authorId ? (
                        <Link
                          href={`/?authorId=${item.authorId}&authorName=${encodeURIComponent(item.authorName)}`}
                          className="text-primary-600 hover:text-primary-800 font-medium"
                          onClick={(e) => e.stopPropagation()} // Prevent double navigation
                        >
                          {item.authorName}
                        </Link>
                      ) : (
                        item.authorName
                      )}
                    </span>

                    {item.avgRating > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                        <span className="font-medium">{item.avgRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {item.cropType && (
                    <div className="mt-3">
                      <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        {item.cropType}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}