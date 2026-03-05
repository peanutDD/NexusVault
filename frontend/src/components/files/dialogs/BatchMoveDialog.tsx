import { useState, useEffect, useMemo } from "react";
import { folderService } from "../../../services/folders";
import type { Folder } from "../../../types/folders";
import { getErrorMessage } from "../../../utils/error";
import { Home, Check, Loader2, FolderSymlink } from "lucide-react";
import { cn } from "../../../utils/cn";
import ConfirmDialog from "../../common/dialog/ConfirmDialog";
import ErrorMessage from "../../common/feedback/ErrorMessage";

interface BatchMoveDialogProps {
  fileIds: string[];
  folderIds: string[];
  fileCount: number;
  folderCount: number;
  onClose: () => void;
  onMoved?: () => void;
  /** 执行移动前乐观更新，返回回滚函数；失败时调用回滚 */
  onApplyOptimistic?: (
    fileIds: string[],
    folderIds: string[],
    targetFolderId: string | null,
  ) => (() => void) | void;
}

export default function BatchMoveDialog({
  fileIds,
  folderIds,
  fileCount,
  folderCount,
  onClose,
  onMoved,
  onApplyOptimistic,
}: BatchMoveDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [targetFolderId, setTargetFolderId] = useState<string>("");

  // 过滤掉要移动的文件夹本身，不能移动到自身
  const availableFolders = useMemo(() => {
    const movingFolderSet = new Set(folderIds);
    return folders.filter((f) => !movingFolderSet.has(f.id));
  }, [folders, folderIds]);

  // 构建选择描述
  const selectionText = useMemo(() => {
    const parts: string[] = [];
    if (fileCount > 0) parts.push(`${fileCount} 个文件`);
    if (folderCount > 0) parts.push(`${folderCount} 个文件夹`);
    return parts.join("、");
  }, [fileCount, folderCount]);

  useEffect(() => {
    const loadFolders = async () => {
      setLoadingFolders(true);
      try {
        const list = await folderService.list();
        setFolders(list);
      } catch {
        setFolders([]);
      } finally {
        setLoadingFolders(false);
      }
    };
    loadFolders();
  }, []);

  const handleMove = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const folderId = targetFolderId || null;
    const rollback = onApplyOptimistic?.(fileIds, folderIds, folderId);

    try {
      let movedFiles = 0;
      let movedFolders = 0;

      if (fileIds.length > 0) {
        movedFiles = await folderService.moveFilesToFolder(fileIds, folderId);
      }

      if (folderIds.length > 0) {
        movedFolders = await folderService.moveFolders(folderIds, folderId);
      }

      const anyMoved = movedFiles > 0 || movedFolders > 0;
      if (!anyMoved) {
        rollback?.();
        setError("没有项目被移动，请重试或检查目标位置。");
        return;
      }

      const folderName = folderId
        ? folders.find((f) => f.id === folderId)?.name
        : "根目录";

      const resultParts: string[] = [];
      if (movedFiles > 0) resultParts.push(`${movedFiles} 个文件`);
      if (movedFolders > 0) resultParts.push(`${movedFolders} 个文件夹`);

      setSuccess(`已将 ${resultParts.join("、")} 移动至「${folderName}」`);
      setTimeout(() => {
        onMoved?.();
        onClose();
      }, 1200);
    } catch (err) {
      rollback?.();
      setError(getErrorMessage(err, "移动失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, loading]);

  const handleSafeClose = () => {
    if (!loading) onClose();
  };

  const message = (
    <div className="space-y-3" data-oid="cv5xfoz">
      {error && (
        <ErrorMessage
          message={error}
          onClose={() => setError(null)}
          type="error"
          data-oid="db9r3ir"
        />
      )}

      {success && (
        <ErrorMessage
          message={success}
          onClose={() => setSuccess(null)}
          type="info"
          data-oid="f7dwcxj"
        />
      )}

      {/* 已选摘要 */}
      <div
        className="rounded-lg border border-[var(--dialog-panel-border)] bg-[var(--dialog-panel-bg)] px-3 py-2"
        data-oid="0wuphy5"
      >
        <p
          className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
          data-oid="mil:15n"
        >
          已选择
        </p>
        <p
          className="mt-0.5 font-brand text-sm font-normal tracking-wide text-[var(--dialog-panel-text)]"
          data-oid="i6ui2fa"
        >
          <span className="font-semibold text-[var(--dialog-panel-accent)]" data-oid="nvwq_d3">
            {selectionText}
          </span>
        </p>
      </div>

      {/* 目标位置：标题 + 列表 */}
      <div data-oid="x:-p7se">
        <p
          className="mb-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
          data-oid="07cslc8"
        >
          目标位置
        </p>
        {loadingFolders ? (
          <div
            className="flex items-center justify-center rounded-lg border border-[var(--dialog-list-loading-border)] bg-[var(--dialog-list-loading-bg)] py-6 text-[var(--dialog-list-loading-text)]"
            data-oid="zc--m82"
          >
            <Loader2
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
              data-oid="9zciazk"
            />

            <span className="ml-2 text-xs" data-oid="wv0_6ud">
              加载中…
            </span>
          </div>
        ) : (
          <div
            className="max-h-44 overflow-y-auto rounded-lg border border-[var(--dialog-list-border)] bg-[var(--dialog-list-bg)] py-1"
            data-oid="jie0rhg"
          >
            <button
              type="button"
              onClick={() => setTargetFolderId("")}
              disabled={loading}
              className={cn(
                "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-xs text-[var(--dialog-list-item-text)] transition-colors",
                targetFolderId === ""
                  ? "bg-[var(--dialog-list-item-selected-bg)] text-[var(--dialog-list-item-selected-text)]"
                  : "hover:bg-[var(--dialog-list-item-hover-bg)]",
              )}
              data-oid="ixs:-:s"
            >
              <Home
                className="h-3.5 w-3.5 shrink-0 text-[var(--dialog-list-item-icon)]"
                aria-hidden="true"
                data-oid="-vetu5j"
              />

              <span className="min-w-0 flex-1 truncate" data-oid="rl5.vtc">
                Root
              </span>
              {targetFolderId === "" && (
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-[var(--dialog-list-item-selected-icon)]"
                  aria-hidden="true"
                  data-oid="k-jaak5"
                />
              )}
            </button>
            {availableFolders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setTargetFolderId(folder.id)}
                disabled={loading}
                className={cn(
                  "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-xs text-[var(--dialog-list-item-text)] transition-colors",
                  targetFolderId === folder.id
                    ? "bg-[var(--dialog-list-item-selected-bg)] text-[var(--dialog-list-item-selected-text)]"
                    : "hover:bg-[var(--dialog-list-item-hover-bg)]",
                )}
                data-oid="63yc..k"
              >
                {targetFolderId === folder.id ? (
                  <i
                    className="bi bi-folder2-open h-3.5 w-3.5 shrink-0 text-[var(--dialog-list-item-selected-icon)]"
                    aria-hidden
                    data-oid="yyfkb5t"
                  />
                ) : (
                  <i
                    className="bi bi-folder2 h-3.5 w-3.5 shrink-0 text-[var(--dialog-list-item-icon)]"
                    aria-hidden
                    data-oid="a6a42ln"
                  />
                )}
                <span className="min-w-0 flex-1 truncate" data-oid="if0gxoq">
                  {folder.name}
                </span>
                {targetFolderId === folder.id && (
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-[var(--dialog-list-item-selected-icon)]"
                    aria-hidden="true"
                    data-oid="wxw2mkm"
                  />
                )}
              </button>
            ))}
            {availableFolders.length === 0 && (
              <p
                className="px-2.5 py-4 text-center text-xs text-[var(--dialog-list-item-muted)]"
                data-oid="usgeo3h"
              >
                暂无可用文件夹
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <ConfirmDialog
      open
      appearance="glass"
      variant="info"
      icon={<FolderSymlink className="h-5 w-5" data-oid="g7_mx0g" />}
      iconBgClass="bg-[var(--dialog-accent-blue-bg)]"
      iconColorClass="text-[var(--dialog-accent-blue-text)]"
      title="批量移动"
      message={message}
      confirmText="执行移动"
      cancelText="取消"
      loading={loading}
      onConfirm={handleMove}
      onCancel={handleSafeClose}
      data-oid="ufpx8xt"
    />
  );
}
