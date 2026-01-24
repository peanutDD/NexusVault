import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import PageLayout from '../components/layout/PageLayout';
import FileUpload from '../components/files/FileUpload';
import FileList from '../components/files/FileList';
import { clearFileListCache } from '../utils/fileListCache';

export default function Files() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate('/login');
  }, [clearAuth, navigate]);

  const handleUploadSuccess = useCallback(() => {
    clearFileListCache();
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <PageLayout username={user?.username} onLogout={handleLogout}>
      <FileUpload onUploadSuccess={handleUploadSuccess} />
      <FileList key={refreshKey} />
    </PageLayout>
  );
}
