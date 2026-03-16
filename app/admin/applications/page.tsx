'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Application {
  id: number;
  userId: number;
  name: string;
  email: string;
  credentialsFile: string;
  status: string;
  adminNotes: string;
  createdAt: string;
}

export default function AdminApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    // Load data first - middleware already checked authentication
    // Then verify admin role from database
    const init = async () => {
      const isAdmin = await checkAdmin();
      if (isAdmin) {
        loadApplications();
      } else {
        // If not admin, redirect (but this should be rare since middleware checks token)
        setTimeout(() => {
          router.push('/login');
        }, 100);
      }
    };
    init();
  }, []);

  const checkAdmin = async () => {
    try {
      // First try to get current user
      let res = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      
      if (!res.ok) {
        // Try refreshing token
        await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        
        // Try again
        res = await fetch('/api/auth/me', {
          credentials: 'include',
        });
      }
      
      if (!res.ok) {
        console.error('Auth check failed: Response not OK');
        return false;
      }
      
      const data = await res.json();
      
      if (!data.user) {
        return false;
      }
      
      // Check if user is admin
      if (data.user.role !== 'admin') {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Auth check failed:', error);
      return false;
    }
  };

  const loadApplications = async () => {
    try {
      const res = await fetch('/api/admin/applications');
      const data = await res.json();
      setApplications(data.applications || []);
    } catch (error) {
      console.error('Failed to load applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (applicationId: number, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/admin/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          status,
          adminNotes,
        }),
      });

      if (res.ok) {
        setSelectedApp(null);
        setAdminNotes('');
        loadApplications();
      }
    } catch (error) {
      console.error('Failed to update application:', error);
    }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center text-gray-900">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Professional Applications</h1>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {applications.map((app) => (
              <tr key={app.id}>
                <td className="px-6 py-4 whitespace-nowrap">{app.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{app.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs ${
                    app.status === 'approved' ? 'bg-green-100 text-green-800' :
                    app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {app.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(app.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => setSelectedApp(app)}
                    className="text-primary-600 hover:text-primary-700 text-sm"
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Review Application</h2>
            <div className="space-y-4 mb-4">
              <div className="text-gray-900">
                <strong className="text-gray-900">Name:</strong> <span className="text-gray-700">{selectedApp.name}</span>
              </div>
              <div className="text-gray-900">
                <strong className="text-gray-900">Email:</strong> <span className="text-gray-700">{selectedApp.email}</span>
              </div>
              <div className="text-gray-900">
                <strong className="text-gray-900">Credentials:</strong>{' '}
                <a href={selectedApp.credentialsFile} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700">
                  View File
                </a>
              </div>
              <div className="text-gray-900">
                <strong className="text-gray-900">Status:</strong> <span className="text-gray-700">{selectedApp.status}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDecision(selectedApp.id, 'approved')}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={() => handleDecision(selectedApp.id, 'rejected')}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  setSelectedApp(null);
                  setAdminNotes('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

