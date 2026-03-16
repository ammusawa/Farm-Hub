'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ApplyProfessionalPage() {
  const router = useRouter();
  const [credentialsFile, setCredentialsFile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/auth/me', {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (!data.user) {
          router.push('/login');
        } else {
          setUser(data.user);
          if (data.user.isVerifiedProfessional) {
            router.push('/upload');
          }
        }
      });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // In a real app, you'd upload the file first and get a URL
      // For MVP, we'll just accept a file path/URL
      if (!credentialsFile.trim()) {
        setError('Please provide credentials file');
        return;
      }

      const res = await fetch('/api/professional/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialsFile }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to submit application');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <h2 className="text-xl font-semibold mb-2">Application Submitted!</h2>
          <p>Your application has been submitted successfully. An admin will review it and you'll be notified once approved.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Apply as Professional</h1>

      <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6">
        <p>To upload farming content, you need to be verified as a professional. Please upload your credentials (ID, certificate, etc.) for review.</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Credentials File URL
          </label>
          <input
            type="text"
            value={credentialsFile}
            onChange={(e) => setCredentialsFile(e.target.value)}
            placeholder="Upload your file and paste the URL here (or file path)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Note: In production, implement proper file upload. For MVP, paste the file URL or path.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
}

