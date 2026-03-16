'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Toast from '@/app/components/Toast';

interface Application {
  id: number;
  credentialsFile: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  experience?: string;
  qualifications?: string;
  specialization?: string;
  yearsOfExperience?: number;
  location?: string;
}

interface UploadedFile {
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<any>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Form fields
  const [formData, setFormData] = useState({
    experience: '',
    qualifications: '',
    specialization: '',
    yearsOfExperience: '',
    location: '',
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // Load user info
      const userRes = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      const userData = await userRes.json();
      
      if (!userData.user) {
        router.push('/login');
        return;
      }

      setUser(userData.user);

      // Load application status if professional
      if (userData.user.role === 'professional') {
        const appRes = await fetch('/api/profile/application', {
          credentials: 'include',
        });
        const appData = await appRes.json();
        if (appData.application) {
          setApplication(appData.application);
          setFormData({
            experience: appData.application.experience || '',
            qualifications: appData.application.qualifications || '',
            specialization: appData.application.specialization || '',
            yearsOfExperience: appData.application.yearsOfExperience?.toString() || '',
            location: appData.application.location || '',
          });
          
          // Load uploaded files
          if (appData.application.id) {
            const filesRes = await fetch(`/api/profile/files?applicationId=${appData.application.id}`, {
              credentials: 'include',
            });
            const filesData = await filesRes.json();
            if (filesData.files) {
              setUploadedFiles(filesData.files);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length + uploadedFiles.length + selectedFiles.length > 5) {
      setError('Maximum 5 files allowed');
      return;
    }

    // Validate file sizes (10MB each)
    const maxSize = 10 * 1024 * 1024;
    const invalidFiles = files.filter(f => f.size > maxSize);
    if (invalidFiles.length > 0) {
      setError(`Some files exceed 10MB limit: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }

    setSelectedFiles(prev => [...prev, ...files]);
    setError('');
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveUploadedFile = async (fileId: number) => {
    try {
      const res = await fetch(`/api/profile/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (res.ok) {
        setUploadedFiles(prev => prev.filter(f => (f as any).id !== fileId));
        setToast({ message: 'File removed successfully', type: 'success' });
      }
    } catch (error) {
      setError('Failed to remove file');
    }
  };

  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to upload files');
        return;
      }

      setUploadedFiles(prev => [...prev, ...data.files]);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setToast({ message: `Successfully uploaded ${data.files.length} file(s)`, type: 'success' });
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (uploadedFiles.length === 0) {
        setError('Please upload at least one credentials file');
        return;
      }

      const filePaths = uploadedFiles.map(f => f.filePath).join(',');

      const res = await fetch('/api/professional/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialsFile: filePaths,
          experience: formData.experience,
          qualifications: formData.qualifications,
          specialization: formData.specialization,
          yearsOfExperience: formData.yearsOfExperience ? parseInt(formData.yearsOfExperience) : null,
          location: formData.location,
          files: uploadedFiles,
        }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to submit application');
        return;
      }

      setToast({ message: 'Application submitted successfully! Waiting for admin approval.', type: 'success' });
      setTimeout(() => {
        loadUserData();
      }, 1000);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="text-lg text-gray-900">Loading profile...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <h1 className="text-3xl font-bold mb-6">My Profile</h1>

      {/* User Information */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Account Information</h2>
        <div className="space-y-3">
          <div>
            <span className="text-sm font-medium text-gray-500">Name:</span>
            <span className="ml-2 text-gray-900">{user.name}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Email:</span>
            <span className="ml-2 text-gray-900">{user.email}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Role:</span>
            <span className={`ml-2 px-2 py-1 rounded text-sm ${
              user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
              user.role === 'professional' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </span>
          </div>
          {user.role === 'professional' && (
            <div>
              <span className="text-sm font-medium text-gray-500">Verification Status:</span>
              <span className={`ml-2 px-2 py-1 rounded text-sm ${
                user.isVerifiedProfessional
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {user.isVerifiedProfessional ? 'Verified' : 'Unverified'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Professional Credentials Section */}
      {user.role === 'professional' && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Professional Verification</h2>

          {user.isVerifiedProfessional ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-600 text-xl">✓</span>
                <span className="font-semibold text-green-800">You are verified!</span>
              </div>
              <p className="text-green-700 text-sm mb-4">
                Your professional status has been verified. You can now upload farming content.
              </p>
              {application && (
                <div className="mt-4 space-y-2 text-sm">
                  {application.experience && (
                    <div>
                      <span className="font-medium text-gray-700">Experience: </span>
                      <span className="text-gray-600">{application.experience}</span>
                    </div>
                  )}
                  {application.qualifications && (
                    <div>
                      <span className="font-medium text-gray-700">Qualifications: </span>
                      <span className="text-gray-600">{application.qualifications}</span>
                    </div>
                  )}
                  {application.specialization && (
                    <div>
                      <span className="font-medium text-gray-700">Specialization: </span>
                      <span className="text-gray-600">{application.specialization}</span>
                    </div>
                  )}
                  {application.yearsOfExperience && (
                    <div>
                      <span className="font-medium text-gray-700">Years of Experience: </span>
                      <span className="text-gray-600">{application.yearsOfExperience}</span>
                    </div>
                  )}
                  {application.location && (
                    <div>
                      <span className="font-medium text-gray-700">Location: </span>
                      <span className="text-gray-600">{application.location}</span>
                    </div>
                  )}
                </div>
              )}
              <Link
                href="/upload"
                className="mt-4 inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Upload Content
              </Link>
            </div>
          ) : application ? (
            <div className="space-y-4">
              <div className={`border rounded-lg p-4 ${
                application.status === 'approved' ? 'bg-green-50 border-green-200' :
                application.status === 'rejected' ? 'bg-red-50 border-red-200' :
                'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Application Status</span>
                  <span className={`px-3 py-1 rounded text-sm font-medium ${
                    application.status === 'approved' ? 'bg-green-100 text-green-800' :
                    application.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Submitted: {new Date(application.createdAt).toLocaleString()}
                </p>
                {application.status === 'pending' && (
                  <p className="text-sm text-yellow-700">
                    Your application is under review. An admin will review your credentials shortly.
                  </p>
                )}
                {application.status === 'approved' && (
                  <p className="text-sm text-green-700">
                    Congratulations! Your application has been approved. You can now upload content.
                  </p>
                )}
                {application.status === 'rejected' && (
                  <div>
                    <p className="text-sm text-red-700 mb-2">
                      Your application was rejected. Please review the admin notes below and resubmit if needed.
                    </p>
                    {application.adminNotes && (
                      <div className="bg-white border border-red-200 rounded p-3 mt-2">
                        <p className="text-sm font-medium text-gray-700 mb-1">Admin Notes:</p>
                        <p className="text-sm text-gray-600">{application.adminNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Show uploaded files */}
              {uploadedFiles.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Uploaded Files ({uploadedFiles.length}/5)</h3>
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">{file.fileName}</span>
                          <span className="text-xs text-gray-500">({formatFileSize(file.fileSize)})</span>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={file.filePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:underline"
                          >
                            View
                          </a>
                          {application.status === 'rejected' && (
                            <button
                              onClick={() => handleRemoveUploadedFile((file as any).id)}
                              className="text-sm text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {application.status === 'rejected' && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Resubmit Application</h3>
                  <ApplicationForm
                    formData={formData}
                    setFormData={setFormData}
                    selectedFiles={selectedFiles}
                    uploadedFiles={uploadedFiles}
                    fileInputRef={fileInputRef}
                    handleFileSelect={handleFileSelect}
                    handleRemoveFile={handleRemoveFile}
                    handleUploadFiles={handleUploadFiles}
                    handleSubmit={handleSubmitApplication}
                    error={error}
                    submitting={submitting}
                    uploading={uploading}
                    formatFileSize={formatFileSize}
                  />
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-blue-700 text-sm">
                  To upload farming content, you need to be verified as a professional. Please fill in your details and upload your credentials (ID, certificate, etc.) for review.
                </p>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              <ApplicationForm
                formData={formData}
                setFormData={setFormData}
                selectedFiles={selectedFiles}
                uploadedFiles={uploadedFiles}
                fileInputRef={fileInputRef}
                handleFileSelect={handleFileSelect}
                handleRemoveFile={handleRemoveFile}
                handleUploadFiles={handleUploadFiles}
                handleSubmit={handleSubmitApplication}
                error={error}
                submitting={submitting}
                uploading={uploading}
                formatFileSize={formatFileSize}
              />
            </div>
          )}
        </div>
      )}

      {/* Regular User Message */}
      {user.role === 'user' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Become a Professional</h2>
          <p className="text-gray-600 mb-4">
            Want to share your farming knowledge? Upgrade to a professional account to upload content.
          </p>
          <p className="text-sm text-gray-500">
            Note: Contact an admin to upgrade your account, or register a new account as a professional farmer.
          </p>
        </div>
      )}
    </div>
  );
}

interface ApplicationFormProps {
  formData: any;
  setFormData: any;
  selectedFiles: File[];
  uploadedFiles: UploadedFile[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFile: (index: number) => void;
  handleUploadFiles: () => void;
  handleSubmit: (e: React.FormEvent) => void;
  error: string;
  submitting: boolean;
  uploading: boolean;
  formatFileSize: (bytes: number) => string;
}

function ApplicationForm({
  formData,
  setFormData,
  selectedFiles,
  uploadedFiles,
  fileInputRef,
  handleFileSelect,
  handleRemoveFile,
  handleUploadFiles,
  handleSubmit,
  error,
  submitting,
  uploading,
  formatFileSize,
}: ApplicationFormProps) {
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Profile Information */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Profile Information</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Years of Experience
          </label>
          <input
            type="number"
            min="0"
            value={formData.yearsOfExperience}
            onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="e.g., 5"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Specialization
          </label>
          <input
            type="text"
            value={formData.specialization}
            onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="e.g., Crop Production, Livestock Management"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="e.g., Kaduna, Nigeria"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Experience
          </label>
          <textarea
            value={formData.experience}
            onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Describe your farming experience..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Qualifications
          </label>
          <textarea
            value={formData.qualifications}
            onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="List your qualifications, certifications, training..."
          />
        </div>
      </div>

      {/* File Upload Section */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Credentials Files (Up to 5 files)</h3>
        <p className="text-sm text-gray-500">
          Upload your credentials such as ID, certificates, licenses, etc. (PDF, JPG, PNG, DOC, DOCX - Max 10MB per file)
        </p>

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <p className="text-sm font-medium text-gray-700 mb-2">Uploaded Files ({uploadedFiles.length}/5):</p>
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-white p-2 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{file.fileName}</span>
                    <span className="text-xs text-gray-500">({formatFileSize(file.fileSize)})</span>
                  </div>
                  <a
                    href={file.filePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:underline"
                  >
                    View
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Input */}
        {uploadedFiles.length < 5 && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="block w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 transition-colors"
            >
              <div className="text-center">
                <span className="text-primary-600 font-medium">Click to select files</span>
                <span className="text-gray-500 text-sm block mt-1">
                  or drag and drop files here
                </span>
              </div>
            </label>
          </div>
        )}

        {/* Selected Files Preview */}
        {selectedFiles.length > 0 && (
          <div className="border rounded-lg p-4 bg-blue-50">
            <p className="text-sm font-medium text-gray-700 mb-2">Selected Files ({selectedFiles.length}):</p>
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-white p-2 rounded">
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleUploadFiles}
              disabled={uploading || uploadedFiles.length + selectedFiles.length > 5}
              className="mt-3 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} File(s)`}
            </button>
          </div>
        )}

        <p className="text-xs text-gray-500">
          Total files: {uploadedFiles.length + selectedFiles.length}/5
        </p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitting || uploadedFiles.length === 0}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Submitting...' : 'Submit Application'}
      </button>
    </form>
  );
}
