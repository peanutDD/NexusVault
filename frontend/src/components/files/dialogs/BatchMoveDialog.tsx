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
  onPartialMoved?: () => void;
  /** 执行移动前乐观更新，返回回滚函数；失败时调用回滚 */
  onApplyOptimistic?: (
    fileIds: string[],
    folderIds: string[],
    targetFolderId: string | null,
  ) => (() => void) | void;
}

const truncateByChars = (value: string, maxChars: number) => {
  if (maxChars <= 0) return "";
  const chars = [...value.trim()];
  if (chars.length <= maxChars) return chars.join("");
  return `${chars.slice(0, Math.max(0, maxChars - 1)).join("")}…`;
};

const toShortBatchError = (value: string) => truncateByChars(value, 20);

const formatConflictDetail = (value: string) => {
  const normalized = value
    .replace(/^目标文件夹已存在同名文件[:：]?\s*/g, "")
    .replace(/^文件冲突[:：]?\s*/g, "")
    .trim();
  if (!normalized) return "同名冲突";
  return normalized;
};

export default function BatchMoveDialog({
  fileIds,
  folderIds,
  fileCount,
  folderCount,
  onClose,
  onMoved,
  onPartialMoved,
  onApplyOptimistic,
}: BatchMoveDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);

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
    setErrorDetails([]);

    const folderId = targetFolderId || null;
    const rollback = onApplyOptimistic?.(fileIds, folderIds, folderId);

    try {
      let movedFiles = 0;
      let movedFolders = 0;
      let failedFiles = 0;
      let failedFileErrors: string[] = [];

      if (fileIds.length > 0) {
        const fileMoveResult = await folderService.moveFilesToFolderPartial(
          fileIds,
          folderId,
        );
        movedFiles = fileMoveResult.moved;
        failedFiles = fileMoveResult.failed;
        failedFileErrors = fileMoveResult.errors;
      }

      if (folderIds.length > 0) {
        movedFolders = await folderService.moveFolders(folderIds, folderId);
      }

      const anyMoved = movedFiles > 0 || movedFolders > 0;
      const conflictDetails = failedFileErrors
        .filter((item) => item.trim().length > 0)
        .slice(0, 5)
        .map((item) => toShortBatchError(formatConflictDetail(item)));

      if (!anyMoved) {
        rollback?.();
        if (failedFiles > 0) {
          setError(toShortBatchError(`冲突${failedFiles}个，未移动`));
          setErrorDetails(conflictDetails);
        } else {
          setError(toShortBatchError("没有项目被移动，请检查目标"));
        }
        return;
      }

      const folderName = folderId
        ? folders.find((f) => f.id === folderId)?.name
        : "根目录";

      const resultParts: string[] = [];
      if (movedFiles > 0) resultParts.push(`${movedFiles} 个文件`);
      if (movedFolders > 0) resultParts.push(`${movedFolders} 个文件夹`);

      setSuccess(`已将 ${resultParts.join("、")} 移动至「${folderName}」`);

      if (failedFiles > 0) {
        setError(toShortBatchError(`已移${movedFiles}个，冲突${failedFiles}个`));
        setErrorDetails(conflictDetails);
        onPartialMoved?.();
      } else {
        setTimeout(() => {
          onMoved?.();
          onClose();
        }, 1200);
      }
    } catch (err) {
      rollback?.();
      setError(toShortBatchError(getErrorMessage(err, "移动失败")));
      setErrorDetails([]);
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
    <div className="space-y-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="cv5xfoz">
      {error && (
        <ErrorMessage
          message={error}
          onClose={() => {
            setError(null);
            setErrorDetails([]);
          }}
          type="error"
          data-oid="db9r3ir"
        />
      )}
      {errorDetails.length > 0 && (
        <div
          className="rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-panel-border)] bg-[var(--dialog-panel-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]"
          data-oid="r14y2ft"
        >
          <p
            className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
            data-oid="ii2_3y4"
          >
            冲突文件
          </p>
          <ul className="mt-[clamp(0.2925rem,0.675vw,0.375rem)] space-y-[clamp(0.195rem,0.45vw,0.25rem)]" data-oid="x6xjivh">
            {errorDetails.map((item, index) => (
              <li
                key={`${item}-${index}`}
                className="text-[0.625rem] text-[var(--notice-error)]"
                data-oid="tz5pq6a"
              >
                {`${index + 1}. ${item}`}
              </li>
            ))}
          </ul>
        </div>
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
        className="rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-panel-border)] bg-[var(--dialog-panel-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]"
        data-oid="0wuphy5"
      >
        <p
          className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
          data-oid="mil:15n"
        >
          已选择
        </p>
        <p
          className="mt-[clamp(0.0975rem,0.3vw,0.125rem)] font-brand text-[clamp(0.75rem,1.8vw,0.875rem)] font-normal tracking-wide text-[var(--dialog-panel-text)]"
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
          className="mb-[clamp(0.2925rem,0.675vw,0.375rem)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
          data-oid="07cslc8"
        >
          目标位置
        </p>
        {loadingFolders ? (
          <div
            className="flex items-center justify-center rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-list-loading-border)] bg-[var(--dialog-list-loading-bg)] py-[clamp(1.25rem,2.7vw,1.5rem)] text-[var(--dialog-list-loading-text)]"
            data-oid="zc--m82"
          >
            <Loader2
              className="h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)] animate-spin"
              aria-hidden="true"
              data-oid="9zciazk"
            />

            <span className="ml-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.68rem,1.6vw,0.75rem)]" data-oid="wv0_6ud">
              加载中…
            </span>
          </div>
        ) : (
          <div
            className="max-h-[clamp(10.75rem,19.8vw,11rem)] overflow-y-auto rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-list-border)] bg-[var(--dialog-list-bg)] py-[clamp(0.195rem,0.45vw,0.25rem)]"
            data-oid="jie0rhg"
          >
            <button
              type="button"
              onClick={() => setTargetFolderId("")}
              disabled={loading}
              className={cn(
                "flex w-full items-center gap-[clamp(0.4875rem,1.125vw,0.625rem)] px-[clamp(0.4875rem,1.125vw,0.625rem)] py-[clamp(0.2925rem,0.675vw,0.375rem)] text-left text-[clamp(0.68rem,1.6vw,0.75rem)] text-[var(--dialog-list-item-text)] transition-colors",
                targetFolderId === ""
                  ? "bg-[var(--dialog-list-item-selected-bg)] text-[var(--dialog-list-item-selected-text)]"
                  : "hover:bg-[var(--dialog-list-item-hover-bg)]",
              )}
              data-oid="ixs:-:s"
            >
              <Home
                className="h-[clamp(0.6825rem,1.575vw,0.875rem)] w-[clamp(0.6825rem,1.575vw,0.875rem)] shrink-0 text-[var(--dialog-list-item-icon)]"
                aria-hidden="true"
                data-oid="-vetu5j"
              />

              <span className="min-w-0 flex-1 truncate" data-oid="rl5.vtc">
                Root
              </span>
              {targetFolderId === "" && (
                <Check
                  className="h-[clamp(0.6825rem,1.575vw,0.875rem)] w-[clamp(0.6825rem,1.575vw,0.875rem)] shrink-0 text-[var(--dialog-list-item-selected-icon)]"
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
                  "flex w-full items-center gap-[clamp(0.4875rem,1.125vw,0.625rem)] px-[clamp(0.4875rem,1.125vw,0.625rem)] py-[clamp(0.2925rem,0.675vw,0.375rem)] text-left text-[clamp(0.68rem,1.6vw,0.75rem)] text-[var(--dialog-list-item-text)] transition-colors",
                  targetFolderId === folder.id
                    ? "bg-[var(--dialog-list-item-selected-bg)] text-[var(--dialog-list-item-selected-text)]"
                    : "hover:bg-[var(--dialog-list-item-hover-bg)]",
                )}
                data-oid="63yc..k"
              >
                {targetFolderId === folder.id ? (
                  <i
                    className="bi bi-folder2-open h-[clamp(0.6825rem,1.575vw,0.875rem)] w-[clamp(0.6825rem,1.575vw,0.875rem)] shrink-0 text-[var(--dialog-list-item-selected-icon)]"
                    aria-hidden
                    data-oid="yyfkb5t"
                  />
                ) : (
                  <i
                    className="bi bi-folder2 h-[clamp(0.6825rem,1.575vw,0.875rem)] w-[clamp(0.6825rem,1.575vw,0.875rem)] shrink-0 text-[var(--dialog-list-item-icon)]"
                    aria-hidden
                    data-oid="a6a42ln"
                  />
                )}
                <span className="min-w-0 flex-1 truncate" data-oid="if0gxoq">
                  {folder.name}
                </span>
                {targetFolderId === folder.id && (
                  <Check
                    className="h-[clamp(0.6825rem,1.575vw,0.875rem)] w-[clamp(0.6825rem,1.575vw,0.875rem)] shrink-0 text-[var(--dialog-list-item-selected-icon)]"
                    aria-hidden="true"
                    data-oid="wxw2mkm"
                  />
                )}
              </button>
            ))}
            {availableFolders.length === 0 && (
              <p
                className="px-[clamp(0.4875rem,1.125vw,0.625rem)] py-[clamp(0.78rem,1.8vw,1rem)] text-center text-[clamp(0.68rem,1.6vw,0.75rem)] text-[var(--dialog-list-item-muted)]"
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
      icon={<FolderSymlink className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]" data-oid="g7_mx0g" />}
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
