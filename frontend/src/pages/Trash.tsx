import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArchiveRestore,
  ArrowLeft,
  Check,
  Clock3,
  FileWarning,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import LazyThumbnail from "../components/files/preview/LazyThumbnail";
import PageLayout from "../components/layout/PageLayout";
import ConfirmDialog from "../components/common/dialog/ConfirmDialog";
import { EmptyState } from "../components/common/EmptyState";
import ErrorMessage from "../components/common/feedback/ErrorMessage";
import Spinner from "../components/common/feedback/Spinner";
import { fileService } from "../services/files";
import { useAuthStore } from "../store/authStore";
import { formatBytes } from "../utils/format";
import { getErrorMessage } from "../utils/error";
import { resolveTrashReturnTarget } from "../utils/trashReturnTarget";
import { isImageType } from "../utils/mimeType";
import type { FileMetadata } from "../types/files";
import "../components/files/list/FileListGlass.css";

type ConfirmState =
  | { type: "permanent"; file: FileMetadata }
  | { type: "batch-permanent" }
  | { type: "empty" }
  | null;

const EMPTY_FILES: FileMetadata[] = [];
const TRASH_RETENTION_DAYS = 30;
const RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getRetentionState(value?: string | null) {
  if (!value) {
    return {
      daysLeft: TRASH_RETENTION_DAYS,
      status: `${TRASH_RETENTION_DAYS}D LEFT`,
    };
  }

  const deletedAt = new Date(value).getTime();
  if (Number.isNaN(deletedAt)) {
    return {
      daysLeft: TRASH_RETENTION_DAYS,
      status: "PENDING",
    };
  }

  const elapsed = Math.min(Math.max(Date.now() - deletedAt, 0), RETENTION_MS);
  const daysLeft = Math.max(0, Math.ceil((RETENTION_MS - elapsed) / ONE_DAY_MS));

  return {
    daysLeft,
    status: daysLeft === 0 ? "PURGE QUEUED" : `${daysLeft}D LEFT`,
  };
}

function getCountdownClass(daysLeft: number) {
  if (daysLeft <= 3) return "text-[var(--trash-countdown-danger)]";
  if (daysLeft <= 10) return "text-[var(--trash-countdown-warn)]";
  return "text-[var(--trash-countdown-text)]";
}

type TrashLocationState = {
  from?: string;
};

function getPlaceholderLabel(file: FileMetadata) {
  if (file.mime_type.includes("pdf")) return "PDF";
  if (file.mime_type.startsWith("video/")) return "VIDEO";
  if (file.mime_type.startsWith("audio/")) return "AUDIO";
  if (file.mime_type.includes("zip") || file.mime_type.includes("archive")) {
    return "ZIP";
  }
  return "FILE";
}

function TrashThumbnail({ file }: { file: FileMetadata }) {
  if (isImageType(file.mime_type)) {
    return (
      <LazyThumbnail
        fileId={file.id}
        mimeType={file.mime_type}
        filename={file.original_filename}
        className="h-full w-full rounded-none"
        priority="low"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[clamp(0.25rem,0.8vw,0.65rem)] bg-[image:var(--trash-placeholder-bg)] text-[var(--trash-placeholder-icon)]">
      <FileWarning className="h-[34%] w-[34%]" aria-hidden />
      <span className="max-w-[86%] truncate text-[clamp(0.48rem,0.8vw,0.78rem)] font-semibold uppercase tracking-[0.16em] text-[var(--trash-placeholder-text)]">
        {getPlaceholderLabel(file)}
      </span>
    </div>
  );
}

export default function Trash() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["trash"],
    queryFn: () => fileService.listTrash(),
  });

  const files = data?.files ?? EMPTY_FILES;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedFiles = useMemo(
    () => files.filter((file) => selectedIdSet.has(file.id)),
    [files, selectedIdSet],
  );
  const visibleSelectedIds = useMemo(
    () => selectedFiles.map((file) => file.id),
    [selectedFiles],
  );
  const totalSize = useMemo(
    () => files.reduce((sum, file) => sum + file.file_size, 0),
    [files],
  );
  const selectedCount = selectedFiles.length;

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

  const batchRestoreMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      await Promise.all(fileIds.map((fileId) => fileService.restoreFile(fileId)));
    },
    onSuccess: () => {
      setSelectedIds([]);
      void invalidateFileViews();
    },
    onError: (err) => setError(getErrorMessage(err, "批量还原失败")),
  });

  const permanentMutation = useMutation({
    mutationFn: (fileId: string) => fileService.permanentlyDeleteFile(fileId),
    onSuccess: () => {
      setConfirm(null);
      void invalidateFileViews();
    },
    onError: (err) => setError(getErrorMessage(err, "彻底删除失败")),
  });

  const batchPermanentMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      await Promise.all(
        fileIds.map((fileId) => fileService.permanentlyDeleteFile(fileId)),
      );
    },
    onSuccess: () => {
      setConfirm(null);
      setSelectedIds([]);
      void invalidateFileViews();
    },
    onError: (err) => setError(getErrorMessage(err, "批量彻底删除失败")),
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

  const handleBack = useCallback(() => {
    const state = location.state as TrashLocationState | null;
    navigate(resolveTrashReturnTarget(state?.from));
  }, [location.state, navigate]);

  const toggleSelected = useCallback((fileId: string) => {
    setSelectedIds((current) =>
      current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId],
    );
  }, []);

  const confirmTitle =
    confirm?.type === "empty"
      ? "清空回收站"
      : confirm?.type === "batch-permanent"
        ? "批量彻底删除"
        : "彻底删除文件";
  const confirmMessage =
    confirm?.type === "empty"
      ? "回收站内所有文件都会被彻底删除。"
      : confirm?.type === "batch-permanent"
        ? `选中的 ${selectedCount} 个文件都会被彻底删除。`
        : `「${confirm?.file.original_filename ?? ""}」将被彻底删除。`;
  const confirmText = confirm?.type === "empty" ? "彻底清空" : "彻底删除";
  const confirmLoading =
    confirm?.type === "empty"
      ? emptyMutation.isPending
      : confirm?.type === "batch-permanent"
        ? batchPermanentMutation.isPending
        : permanentMutation.isPending;

  return (
    <PageLayout
      title="Trash"
      username={user?.username}
      onLogout={handleLogout}
      useSolidBackground
      backgroundClassName="bg-[image:var(--trash-page-bg)]"
      data-oid="trash-page"
    >
      <div className="fileListGlassScope space-y-3 sm:space-y-4" data-testid="trash-shell">
        <div
          data-testid="trash-console"
          className="glass-panel glass-panel-toolbar fileListToolbarScale75 trashConsoleToolbar p-3"
        >
          <div
            data-testid="trash-console-inner"
            className="trashConsoleInner relative flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div
              data-testid="trash-console-summary-row"
              className="trashConsoleSummaryRow flex w-fit max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3"
            >
              <h1 className="font-brand text-[clamp(0.82rem,1.25vw,1.05rem)] font-normal tracking-widest text-[var(--filelist-btn-text)]">
                Vault Console
              </h1>
              <span className="glass-chip border border-[var(--filelist-toolbar-btn-border)] bg-[var(--filelist-toolbar-btn-bg)] px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-[var(--filelist-btn-text)] sm:px-2 sm:text-[0.68rem]">
                {files.length} files
              </span>
              <span className="inline-flex items-center gap-1 text-[0.62rem] text-[var(--filelist-text-muted)] sm:text-[0.72rem]">
                <ShieldCheck className="h-3 w-3 text-[var(--filelist-btn-text)] sm:h-3.5 sm:w-3.5" aria-hidden />
                {formatBytes(totalSize)}
              </span>
              <span className="inline-flex items-center gap-1 text-[0.62rem] text-[var(--filelist-text-muted)] sm:text-[0.72rem]">
                <Clock3 className="h-3 w-3 text-[var(--filelist-btn-text)] sm:h-3.5 sm:w-3.5" aria-hidden />
                {TRASH_RETENTION_DAYS}d cleanup
                {isFetching && !isLoading ? " · refreshing" : ""}
              </span>
              {selectedCount > 0 && (
                <span className="glass-chip border border-[var(--filelist-toolbar-btn-border)] bg-[var(--filelist-toolbar-btn-bg)] px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-[var(--filelist-btn-text)] sm:px-2 sm:text-[0.68rem]">
                  {selectedCount} selected
                </span>
              )}
            </div>

            <div
              className={`trashConsoleActions ${selectedCount > 0 ? "trashConsoleActionsSelected" : ""} flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:gap-1.5 sm:overflow-x-auto`}
            >
              {selectedCount > 0 && (
                <div
                  data-testid="trash-batch-actions-row"
                  className="trashBatchActionsRow flex w-full justify-start gap-1 sm:w-auto sm:justify-end sm:gap-1.5"
                >
                  <button
                    type="button"
                    onClick={() => batchRestoreMutation.mutate(visibleSelectedIds)}
                    disabled={batchRestoreMutation.isPending}
                    className="glass-btn toolbarActionBtn trashConsoleButton trashBatchRestoreButton allFilesBtnHighlight font-brand inline-flex w-auto max-w-max shrink-0 items-center justify-center gap-1 px-1.5 text-[0.6rem] font-normal leading-none tracking-widest text-[var(--filelist-btn-text)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 sm:gap-1.5 sm:px-2 sm:text-[0.68rem]"
                    aria-label="批量还原"
                  >
                    <ArchiveRestore className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
                    <span>批量还原</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm({ type: "batch-permanent" })}
                    disabled={batchPermanentMutation.isPending}
                    className="glass-btn toolbarActionBtn trashConsoleButton trashBatchPermanentButton uploadBtnHighlight font-brand inline-flex w-auto max-w-max shrink-0 items-center justify-center gap-1 px-1.5 text-[0.6rem] font-normal leading-none tracking-widest text-[var(--filelist-btn-text)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 sm:gap-1.5 sm:px-2 sm:text-[0.68rem]"
                    aria-label="批量彻底删除"
                  >
                    <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
                    <span>批量彻底删除</span>
                  </button>
                </div>
              )}
              <div
                data-testid="trash-base-actions-row"
                className="trashBaseActionsRow flex w-full justify-end gap-1 sm:w-auto sm:gap-1.5"
              >
                <button
                  type="button"
                  onClick={handleBack}
                  className="glass-btn toolbarActionBtn trashConsoleButton trashBackButton allFilesBtnHighlight font-brand inline-flex w-auto max-w-max shrink-0 items-center justify-center gap-1 px-1.5 text-[0.6rem] font-normal leading-none tracking-widest text-[var(--filelist-btn-text)] transition-all hover:brightness-110 sm:gap-1.5 sm:px-2 sm:text-[0.68rem]"
                  aria-label="返回上一级"
                >
                  <ArrowLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
                  <span>返回上一级</span>
                </button>
                <button
                  type="button"
                  disabled={files.length === 0}
                  onClick={() => setConfirm({ type: "empty" })}
                  aria-label="清空回收站"
                  className="glass-btn toolbarActionBtn trashConsoleButton trashEmptyButton uploadBtnHighlight font-brand inline-flex w-auto max-w-max shrink-0 items-center justify-center gap-1 px-1.5 text-[0.6rem] font-normal leading-none tracking-widest text-[var(--filelist-btn-text)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 sm:gap-1.5 sm:px-2 sm:text-[0.68rem]"
                >
                  <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
                  <span>清空回收站</span>
                </button>
              </div>
            </div>
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
          <div className="flex min-h-48 items-center justify-center rounded-lg border border-[var(--color-border-soft)] bg-[rgba(var(--rgb-white),0.035)]">
            <Spinner size="lg" />
          </div>
        ) : files.length === 0 ? (
          <EmptyState
            title="回收站为空"
            description={`删除的文件会在这里保留 ${TRASH_RETENTION_DAYS} 天`}
            icon={<Trash2 className="h-9 w-9 text-[var(--color-text-muted)]" aria-hidden />}
          />
        ) : (
          <div className="space-y-4">
            <div
              data-testid="trash-card-grid"
              className="grid grid-cols-5 gap-[clamp(0.35rem,0.8vw,0.75rem)] md:grid-cols-10"
            >
              {files.map((file) => {
                const retention = getRetentionState(file.deleted_at);

                return (
                  // The whole card toggles selection; the checkbox gives a visible target.
                  <article
                    key={file.id}
                    data-testid={`trash-card-${file.id}`}
                    aria-label={`${file.original_filename} trash card`}
                    aria-selected={selectedIdSet.has(file.id)}
                    onClick={() => toggleSelected(file.id)}
                    className={`glass-card trashCardFrame group relative flex min-w-0 cursor-pointer flex-col gap-[clamp(0.12rem,0.32vw,0.28rem)] overflow-hidden !rounded-[0.24rem] p-[clamp(0.08rem,0.24vw,0.18rem)] transition-colors ${selectedIdSet.has(file.id) ? "trashCardSelected" : ""}`}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selectedIdSet.has(file.id)}
                      aria-label={`选择 ${file.original_filename}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSelected(file.id);
                      }}
                      className={`absolute right-1 top-1 z-20 inline-flex size-[clamp(0.72rem,1.65vw,0.92rem)] items-center justify-center rounded-full border bg-[var(--filelist-toolbar-btn-bg)] text-[var(--filelist-btn-text)] transition ${selectedIdSet.has(file.id) ? "border-[var(--cta-primary-border)] bg-[rgba(var(--rgb-emerald-400),0.26)] opacity-100 shadow-[0_0_0.9rem_rgba(var(--rgb-emerald-400),0.38)]" : "border-[var(--filelist-toolbar-btn-border)] opacity-75 shadow-[0_0_0.75rem_rgba(var(--rgb-emerald-400),0.18)]"}`}
                    >
                      {selectedIdSet.has(file.id) && (
                        <Check
                          data-testid={`trash-card-check-${file.id}`}
                          className="h-[72%] w-[72%]"
                          aria-hidden
                        />
                      )}
                    </button>
                    <div
                      data-testid={`trash-card-thumbnail-${file.id}`}
                      className="glass-thumb trashCardThumb relative isolate aspect-[4/5] w-full flex-none overflow-hidden !rounded-[0.24rem] bg-[var(--file-card-thumb-bg)] shadow-[var(--trash-card-shadow)]"
                    >
                      <TrashThumbnail file={file} />
                      <div className="pointer-events-none absolute inset-0 bg-[image:var(--trash-thumb-overlay)] opacity-55" />
                      <div
                        data-testid={`trash-card-grid-${file.id}`}
                        className="pointer-events-none absolute inset-0 bg-[image:var(--trash-tech-grid)] bg-[length:clamp(0.85rem,1.7vw,1.25rem)_clamp(0.85rem,1.7vw,1.25rem)] opacity-20"
                      />
                      <div
                        data-testid={`trash-card-beam-${file.id}`}
                        className="pointer-events-none absolute inset-0 bg-[image:var(--trash-tech-beam)] opacity-45"
                      />
                      <div
                        data-testid={`trash-card-scanline-${file.id}`}
                        className="pointer-events-none absolute inset-0 bg-[image:var(--trash-tech-scanline)] opacity-35"
                      />
                      <div
                        data-testid={`trash-card-corner-${file.id}`}
                        className="pointer-events-none absolute inset-0 bg-[image:var(--trash-tech-corner)] opacity-55"
                      />
                      <div className="absolute bottom-1 right-1 z-10 flex items-center gap-0.5 opacity-70 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            restoreMutation.mutate(file.id);
                          }}
                          disabled={restoreMutation.isPending}
                          data-testid={`trash-card-restore-${file.id}`}
                          className="glass-btn allFilesBtnHighlight inline-flex size-[clamp(0.6rem,1.75vw,0.86rem)] items-center justify-center p-0 text-[var(--filelist-btn-text)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`还原 ${file.original_filename}`}
                          title="Restore"
                        >
                          <ArchiveRestore className="h-[58%] w-[58%]" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setConfirm({ type: "permanent", file });
                          }}
                          disabled={permanentMutation.isPending}
                          className="glass-btn uploadBtnHighlight inline-flex size-[clamp(0.6rem,1.75vw,0.86rem)] items-center justify-center p-0 text-[var(--filelist-btn-text)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`彻底删除 ${file.original_filename}`}
                          title="Purge"
                        >
                          <XCircle className="h-[58%] w-[58%]" aria-hidden />
                        </button>
                      </div>
                    </div>

                    <div
                      data-testid={`trash-card-meta-${file.id}`}
                      className="trashCardMeta flex min-h-[2.05rem] flex-none flex-col items-center justify-center rounded-[0.16rem] px-[clamp(0.1rem,0.36vw,0.32rem)] py-[clamp(0.12rem,0.34vw,0.36rem)] text-center"
                    >
                      <h3
                        data-testid={`trash-card-title-${file.id}`}
                        className="w-full truncate text-[clamp(0.48rem,0.75vw,0.8rem)] font-semibold leading-tight text-[var(--trash-card-title)]"
                        title={file.original_filename}
                      >
                        {file.original_filename}
                      </h3>
                      <span
                        data-testid={`trash-card-footer-countdown-${file.id}`}
                        className={`mt-0.5 w-full truncate text-[clamp(0.42rem,0.66vw,0.68rem)] font-medium leading-none ${getCountdownClass(retention.daysLeft)}`}
                      >
                        {retention.daysLeft} days left
                      </span>
                    </div>
                  </article>
                );
              })}
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
          } else if (confirm?.type === "batch-permanent") {
            batchPermanentMutation.mutate(visibleSelectedIds);
          } else if (confirm?.type === "permanent") {
            permanentMutation.mutate(confirm.file.id);
          }
        }}
      />
    </PageLayout>
  );
}
