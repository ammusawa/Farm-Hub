'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'professional' | 'admin';
  isVerifiedProfessional: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'admins' | 'professionals' | 'viewers'>('professionals');
  const [users, setUsers] = useState<User[]>([]);
  const [counts, setCounts] = useState({ admins: 0, professionals: 0, viewers: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // Load data first - middleware already checked authentication
    // Then verify admin role from database
    const init = async () => {
      const isAdmin = await checkAdmin();
      if (isAdmin) {
        loadCounts();
      } else {
        // If not admin, redirect (but this should be rare since middleware checks token)
        setTimeout(() => {
          router.push('/login');
        }, 100);
      }
    };
    init();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [activeTab]);

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

  const loadCounts = async () => {
    try {
      const [adminsRes, professionalsRes, viewersRes] = await Promise.all([
        fetch('/api/admin/users?role=admin', { credentials: 'include' }),
        fetch('/api/admin/users?role=professional', { credentials: 'include' }),
        fetch('/api/admin/users?role=user', { credentials: 'include' }),
      ]);

      const [adminsData, professionalsData, viewersData] = await Promise.all([
        adminsRes.json(),
        professionalsRes.json(),
        viewersRes.json(),
      ]);

      setCounts({
        admins: adminsData.users?.length || 0,
        professionals: professionalsData.users?.length || 0,
        viewers: viewersData.users?.length || 0,
      });
    } catch (error) {
      console.error('Failed to load counts:', error);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const role = activeTab === 'admins' ? 'admin' : activeTab === 'professionals' ? 'professional' : 'user';
      const res = await fetch(`/api/admin/users?role=${role}`, {
        credentials: 'include',
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveProfessional = async (userId: number) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'approve',
          adminNotes: adminNotes || null,
        }),
        credentials: 'include',
      });

      if (res.ok) {
        setSelectedUser(null);
        setAdminNotes('');
        loadUsers();
        loadCounts();
        alert('Professional approved successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to approve professional');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectProfessional = async (userId: number) => {
    if (!adminNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'reject',
          adminNotes,
        }),
        credentials: 'include',
      });

      if (res.ok) {
        setSelectedUser(null);
        setAdminNotes('');
        loadUsers();
        loadCounts();
        alert('Professional rejected successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reject professional');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeProfessional = async (userId: number) => {
    if (!confirm('Are you sure you want to revoke this professional\'s verification? They will no longer be able to upload content.')) {
      return;
    }

    const notes = prompt('Please provide a reason for revoking verification (optional):');
    if (notes === null) {
      return; // User cancelled
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'reject',
          adminNotes: notes || 'Verification revoked by admin',
        }),
        credentials: 'include',
      });

      if (res.ok) {
        loadUsers();
        loadCounts();
        alert('Professional verification revoked successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to revoke verification');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAdmin = async (userId: number, makeAdmin: boolean) => {
    if (!confirm(`Are you sure you want to ${makeAdmin ? 'make' : 'remove'} this user as admin?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          role: makeAdmin ? 'admin' : 'user',
        }),
        credentials: 'include',
      });

      if (res.ok) {
        loadUsers();
        loadCounts();
        alert(`User ${makeAdmin ? 'promoted to' : 'removed from'} admin successfully!`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update user role');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="text-lg text-gray-900">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('admins')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'admins'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Admins ({counts.admins})
        </button>
        <button
          onClick={() => setActiveTab('professionals')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'professionals'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Professionals ({counts.professionals})
        </button>
        <button
          onClick={() => setActiveTab('viewers')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'viewers'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Users
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No {activeTab} found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {activeTab === 'professionals' ? (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        user.isVerifiedProfessional
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {user.isVerifiedProfessional ? 'Verified' : 'Unverified'}
                      </span>
                    ) : activeTab === 'viewers' ? (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        User
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {activeTab === 'professionals' && (
                      <>
                        {!user.isVerifiedProfessional && (
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="text-primary-600 hover:text-primary-700 mr-3"
                          >
                            Review
                          </button>
                        )}
                        {user.isVerifiedProfessional && (
                          <button
                            onClick={() => handleRevokeProfessional(user.id)}
                            className="text-red-600 hover:text-red-700"
                            disabled={actionLoading}
                          >
                            Revoke
                          </button>
                        )}
                      </>
                    )}
                    {activeTab === 'admins' && (
                      <button
                        onClick={() => handleToggleAdmin(user.id, false)}
                        className="text-red-600 hover:text-red-700"
                        disabled={actionLoading}
                      >
                        Remove Admin
                      </button>
                    )}
                    {activeTab === 'viewers' && (
                      <button
                        onClick={() => handleToggleAdmin(user.id, true)}
                        className="text-primary-600 hover:text-primary-700"
                        disabled={actionLoading}
                      >
                        Make Admin
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Review Professional Modal */}
      {selectedUser && activeTab === 'professionals' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Review Professional Application</h2>
            <div className="space-y-4 mb-4">
              <div className="text-gray-900">
                <strong className="text-gray-900">Name:</strong> <span className="text-gray-700">{selectedUser.name}</span>
              </div>
              <div className="text-gray-900">
                <strong className="text-gray-900">Email:</strong> <span className="text-gray-700">{selectedUser.email}</span>
              </div>
              <div className="text-gray-900">
                <strong className="text-gray-900">Status:</strong>{' '}
                <span className={`px-2 py-1 rounded text-xs ${
                  selectedUser.isVerifiedProfessional
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedUser.isVerifiedProfessional ? 'Verified' : 'Unverified'}
                </span>
              </div>
              <div className="text-gray-900">
                <strong className="text-gray-900">Joined:</strong> <span className="text-gray-700">{new Date(selectedUser.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Notes {!selectedUser.isVerifiedProfessional && '(Required for rejection)'}
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows={4}
                  placeholder="Add notes about this professional..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleApproveProfessional(selectedUser.id)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Approve & Verify'}
              </button>
              <button
                onClick={() => handleRejectProfessional(selectedUser.id)}
                disabled={actionLoading || !adminNotes.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Reject'}
              </button>
              <button
                onClick={() => {
                  setSelectedUser(null);
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

