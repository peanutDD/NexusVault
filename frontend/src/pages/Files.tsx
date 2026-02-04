import { useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import PageLayout from '../components/layout/PageLayout';
import FileList from '../components/files/list/FileList';
import { clearFileListCache } from '../utils/fileListCache';

// 懒加载重型对话框组件
const UploadDialog = lazy(() => import('../components/files/upload/UploadDialog'));

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
      {/* 上传对话框 - 懒加载 */}
      {uploadDialogOpen && (
        <Suspense fallback={null}>
          <UploadDialog
            open={uploadDialogOpen}
            onClose={() => setUploadDialogOpen(false)}
            onUploadComplete={handleUploadComplete}
          />
        </Suspense>
      )}

      {/* 文件列表 */}
      <FileList
        key={refreshKey}
        onOpenUpload={() => setUploadDialogOpen(true)}
      />
    </PageLayout>
  );
}
