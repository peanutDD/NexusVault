import { useState, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import PageLayout from "../components/layout/PageLayout";
import FileList from "../components/files/list/FileList";
import { FILE_COLLECTION_COUNTS_QUERY_KEY } from "../services/fileListService";
import { clearFileListCache } from "../utils/fileListCache";

// 懒加载重型对话框组件
const UploadDialog = lazy(
  () => import("../components/files/upload/UploadDialog"),
);

export default function Files() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate("/login");
  }, [clearAuth, navigate]);

  const handleUploadComplete = useCallback(() => {
    clearFileListCache();
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({
      queryKey: FILE_COLLECTION_COUNTS_QUERY_KEY,
    });
    setRefreshKey((k) => k + 1);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [queryClient]);

  return (
    <PageLayout
      username={user?.username}
      onLogout={handleLogout}
      hideFooter={uploadDialogOpen}
      data-oid="_.p3.bw"
    >
      {/* 上传对话框 - 懒加载 */}
      {uploadDialogOpen && (
        <Suspense fallback={null} data-oid="9oj81xl">
          <UploadDialog
            open={uploadDialogOpen}
            onClose={() => setUploadDialogOpen(false)}
            onUploadComplete={handleUploadComplete}
            data-oid="jpx-5gw"
          />
        </Suspense>
      )}

      {/* 文件列表 */}
      <FileList
        key={refreshKey}
        onOpenUpload={() => setUploadDialogOpen(true)}
        data-oid="b.s_-vo"
      />
    </PageLayout>
  );
}
