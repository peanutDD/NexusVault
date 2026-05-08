import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Trash2, XCircle } from "lucide-react";
import PageLayout from "../components/layout/PageLayout";
import Button from "../components/common/Button";
import ConfirmDialog from "../components/common/dialog/ConfirmDialog";
import { EmptyState } from "../components/common/EmptyState";
import ErrorMessage from "../components/common/feedback/ErrorMessage";
import Spinner from "../components/common/feedback/Spinner";
import { fileService } from "../services/files";
import { useAuthStore } from "../store/authStore";
import { formatBytes } from "../utils/format";
import { getErrorMessage } from "../utils/error";
import type { FileMetadata } from "../types/files";

type ConfirmState =
  | { type: "permanent"; file: FileMetadata }
  | { type: "empty" }
  | null;

const EMPTY_FILES: FileMetadata[] = [];

function formatDeletedAt(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function Trash() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["trash"],
    queryFn: () => fileService.listTrash(),
  });

  const files = data?.files ?? EMPTY_FILES;
  const totalSize = useMemo(
    () => files.reduce((sum, file) => sum + file.file_size, 0),
    [files],
  );

  const invalidateFileViews = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["trash"] }),
      queryClient.invalidateQueries({ queryKey: ["files"] }),
    ]);
  }, [queryClient]);

  const restoreMutation = useMutation({
    mutationFn: (fileId: string) => fileService.restoreFile(fileId),
    onSuccess: () => {
      void invalidateFileViews();
    },
    onError: (err) => setError(getErrorMessage(err, "还原失败")),
  });

  const permanentMutation = useMutation({
    mutationFn: (fileId: string) => fileService.permanentlyDeleteFile(fileId),
    onSuccess: () => {
      setConfirm(null);
      void invalidateFileViews();
    },
    onError: (err) => setError(getErrorMessage(err, "彻底删除失败")),
  });

  const emptyMutation = useMutation({
    mutationFn: () => fileService.emptyTrash(),
    onSuccess: () => {
      setConfirm(null);
      void invalidateFileViews();
    },
    onError: (err) => setError(getErrorMessage(err, "清空回收站失败")),
  });

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate("/login");
  }, [clearAuth, navigate]);

  const confirmTitle = confirm?.type === "empty" ? "清空回收站" : "彻底删除文件";
  const confirmMessage =
    confirm?.type === "empty"
      ? "回收站内所有文件都会被彻底删除。"
      : `「${confirm?.file.original_filename ?? ""}」将被彻底删除。`;
  const confirmText = confirm?.type === "empty" ? "彻底清空" : "彻底删除";
  const confirmLoading =
    confirm?.type === "empty" ? emptyMutation.isPending : permanentMutation.isPending;

  return (
    <PageLayout
      title="TRASH"
      username={user?.username}
      onLogout={handleLogout}
      useSolidBackground
      data-oid="trash-page"
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-brand text-[length:var(--settings-text-xl)] font-normal tracking-widest text-[var(--settings-title)]">
              回收站
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {files.length} 个文件 · {formatBytes(totalSize)}
              {isFetching && !isLoading ? " · 更新中" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate("/files")}>
              返回文件
            </Button>
            <Button
              variant="danger"
              disabled={files.length === 0}
              onClick={() => setConfirm({ type: "empty" })}
              aria-label="清空回收站"
            >
              清空回收站
            </Button>
          </div>
        </div>

        {error && (
          <ErrorMessage
            message={error}
            type="error"
            onClose={() => setError(null)}
            autoDismissMs={5000}
          />
        )}

        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : files.length === 0 ? (
          <EmptyState
            title="回收站为空"
            description="删除的文件会在这里保留 30 天"
            icon={<Trash2 className="h-9 w-9 text-[var(--color-text-muted)]" aria-hidden />}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-[rgba(var(--rgb-white),0.04)]">
            <div className="divide-y divide-[var(--color-border-soft)]">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--color-text-primary)]">
                      {file.original_filename}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {formatBytes(file.file_size)} · 删除于 {formatDeletedAt(file.deleted_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border-soft)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      onClick={() => restoreMutation.mutate(file.id)}
                      aria-label={`还原 ${file.original_filename}`}
                      title="还原"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border-soft)] text-[var(--nav-btn-icon-danger)] hover:border-[var(--nav-btn-border-danger-hover)]"
                      onClick={() => setConfirm({ type: "permanent", file })}
                      aria-label={`彻底删除 ${file.original_filename}`}
                      title="彻底删除"
                    >
                      <XCircle className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={confirmText}
        variant="danger"
        appearance="glass"
        loading={confirmLoading}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.type === "empty") {
            emptyMutation.mutate();
          } else if (confirm?.type === "permanent") {
            permanentMutation.mutate(confirm.file.id);
          }
        }}
      />
    </PageLayout>
  );
}
