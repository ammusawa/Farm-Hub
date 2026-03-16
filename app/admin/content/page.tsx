'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/app/contexts/LanguageContext';

interface Content {
  id: number;
  title: string;
  authorName: string;
  language: string;
  contentType: string;
  createdAt: string;
}

export default function AdminContentPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdmin();
    loadContent();
  }, [language]);

  const checkAdmin = async () => {
    const res = await fetch('/api/auth/me', {
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.user || data.user.role !== 'admin') {
      router.push('/login');
    }
  };

  const loadContent = async () => {
    try {
      const translateParam = language && language !== 'default' ? `&translate=${language}` : '';
      const res = await fetch(`/api/content?limit=100${translateParam}`);
      const data = await res.json();
      setContent(data.content || []);
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center text-gray-900">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Content Moderation</h1>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Language</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {content.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900 line-clamp-2">{item.title}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.authorName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.language}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.contentType}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(item.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Link
                    href={`/content/${item.id}`}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

