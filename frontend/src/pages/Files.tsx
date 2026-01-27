import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import PageLayout from '../components/layout/PageLayout';
import UploadDialog from '../components/files/UploadDialog';
import FileList from '../components/files/FileList';
import { clearFileListCache } from '../utils/fileListCache';

export default function Files() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate('/login');
  }, [clearAuth, navigate]);

  const handleUploadComplete = useCallback(() => {
    clearFileListCache();
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <PageLayout username={user?.username} onLogout={handleLogout}>
      {/* 上传按钮 */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setUploadDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-purple-500/25 transition-all hover:bg-purple-500 hover:shadow-purple-500/40 active:scale-95"
        >
          <UploadIcon />
          Upload Files
        </button>
      </div>

      {/* 上传对话框 */}
      <UploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUploadComplete={handleUploadComplete}
      />

      {/* 文件列表 */}
      <FileList key={refreshKey} />
    </PageLayout>
  );
}

function UploadIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );
}
