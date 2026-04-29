import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { fileService } from "../../../services/files";
import { getErrorMessage } from "../../../utils/error";
import {
  validateFile,
  getMaxBatchCount,
  isLargeFileForConcurrentLimit,
} from "../../../utils/uploadValidation";
import { UPLOAD_QUEUE, LARGE_FILE_UPLOAD } from "../../../constants";
import { UploadQueue } from "../../../utils/uploadQueue";
import { type UploadFile } from "./UploadFileItem";
import UploadDropzone from "./UploadDropzone";
import UploadUrlForm from "./UploadUrlForm";
import UploadProgressList from "./UploadProgressList";
import "./UploadDialog.css";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

const uploadQueue = new UploadQueue(
  UPLOAD_QUEUE.MAX_COST,
  UPLOAD_QUEUE.LARGE_FILE_THRESHOLD_BYTES,
);

/**
 * 上传对话框组件
 * 完美复刻设计稿的布局、配色、比例
 */
export default function UploadDialog({
  open,
  onClose,
  onUploadComplete,
}: UploadDialogProps) {
  const [searchParams] = useSearchParams();
  const [dragActive, setDragActive] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isUploadingRef = useRef(false);
  // 用 ref 保存真实状态，绕过 React 18 StrictMode 双重调用导致的 prev 始终为初始值问题
  const uploadFilesRef = useRef<UploadFile[]>([]);

  // 封装 setState，同时更新 ref 和 state
  const updateUploadFiles = useCallback(
    (updater: UploadFile[] | ((prev: UploadFile[]) => UploadFile[])) => {
      const newValue =
        typeof updater === "function"
          ? updater(uploadFilesRef.current)
          : updater;
      uploadFilesRef.current = newValue;
      setUploadFiles(newValue);
    },
    [],
  );

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const root = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevRootOverflow = root.style.overflow;
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevBodyOverflow;
      root.style.overflow = prevRootOverflow;
    };
  }, [open]);

  const maxBatchCount = getMaxBatchCount();
  const folderId = searchParams.get("folder") || null;
  /** 总文件数（20）超限时的提醒 */
  const [totalLimitWarning, setTotalLimitWarning] = useState("");
  /** 大文件数（10）超限时的提醒 */
  const [largeLimitWarning, setLargeLimitWarning] = useState("");
  /** 重复文件（同名同大小）已忽略的提醒 */
  const [duplicateWarning, setDuplicateWarning] = useState("");

  /** 文件唯一键：同名 + 同大小 + 同修改时间视为同一文件，用于去重 */
  const fileDedupKey = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

  /** 唯一写入口：把 File[] 追加到上传列表。逻辑：先按同名同大小去重，再总数量最多 20、大文件最多 10，分开提醒。 */
  const appendFilesToState = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setTotalLimitWarning("");
      setLargeLimitWarning("");
      setDuplicateWarning("");

      const currentFiles = uploadFilesRef.current;
      const currentKeys = new Set(
        currentFiles.filter((f) => f.file).map((f) => fileDedupKey(f.file!)),
      );
      const seen = new Set<string>();
      const deduped: File[] = [];
      let duplicateCount = 0;
      for (const file of files) {
        const key = fileDedupKey(file);
        if (currentKeys.has(key) || seen.has(key)) {
          duplicateCount++;
        } else {
          seen.add(key);
          deduped.push(file);
        }
      }
      if (duplicateCount > 0) {
        setDuplicateWarning(
          `已忽略 ${duplicateCount} 个重复文件（同名同大小）`,
        );
      }
      if (deduped.length === 0) return;

      const currentLargeCount = currentFiles.filter(
        (f) => f.file && isLargeFileForConcurrentLimit(f.file.size),
      ).length;
      const remainingTotalSlots = maxBatchCount - currentFiles.length;
      if (remainingTotalSlots <= 0) {
        setTotalLimitWarning(
          `单次最多上传 ${maxBatchCount} 个文件，当前已满。请先完成或取消后再添加。`,
        );
        return;
      }

      const remainingLargeSlots =
        LARGE_FILE_UPLOAD.MAX_CONCURRENT - currentLargeCount;
      const [largeFiles, smallFiles] = [
        deduped.filter((f) => isLargeFileForConcurrentLimit(f.size)),
        deduped.filter((f) => !isLargeFileForConcurrentLimit(f.size)),
      ];

      const largeToAdd = largeFiles.slice(0, Math.max(0, remainingLargeSlots));
      const largeSkipped = largeFiles.length - largeToAdd.length;
      const smallToAdd = smallFiles.slice(
        0,
        Math.max(0, remainingTotalSlots - largeToAdd.length),
      );
      const smallSkipped = smallFiles.length - smallToAdd.length;
      const filesToAdd = [...largeToAdd, ...smallToAdd].slice(
        0,
        remainingTotalSlots,
      );

      if (largeSkipped > 0) {
        setLargeLimitWarning(
          `大文件（≥100MB）最多 ${LARGE_FILE_UPLOAD.MAX_CONCURRENT} 个，${largeSkipped} 个大文件未添加。请先完成或取消后再添加。`,
        );
      }
      if (smallSkipped > 0 || filesToAdd.length < deduped.length) {
        const totalSkipped = deduped.length - filesToAdd.length;
        if (totalSkipped > 0) {
          setTotalLimitWarning(
            `单次最多 ${maxBatchCount} 个文件（含大文件），${totalSkipped} 个文件未添加。`,
          );
        }
      }

      const baseId = Date.now();
      const newEntries: UploadFile[] = filesToAdd.map((file, index) => {
        const validation = validateFile(file);
        return {
          id: `upload-${baseId}-${index}-${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          status: validation.ok ? "pending" : "error",
          progress: 0,
          error: validation.ok ? undefined : validation.error,
          file: validation.ok ? file : undefined,
        };
      });

      updateUploadFiles([...currentFiles, ...newEntries]);
    },
    [maxBatchCount, updateUploadFiles],
  );

  /** 拖拽：直接传 FileList，转数组后追加 */
  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      appendFilesToState(Array.from(fileList));
    },
    [appendFilesToState],
  );

  /** URL 上传：添加单个文件到列表 */
  const handleUrlFileAdd = useCallback(
    (uploadFile: UploadFile) => {
      updateUploadFiles((prev) => [...prev, uploadFile]);
    },
    [updateUploadFiles],
  );

  // 打开弹窗时清空 input 并强制 multiple，避免部分环境不认 JSX 的 multiple
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.setAttribute("multiple", "");
    }
  }, [open]);

  // 开始上传所有 pending 文件（可多次点击：大文件上传中时新加入的文件可再次点击开始上传）
  const startUpload = useCallback(async () => {
    // 使用 ref 获取最新状态，避免闭包捕获旧的 uploadFiles
    const currentFiles = uploadFilesRef.current;
    const pendingFiles = currentFiles.filter(
      (f) => f.status === "pending" && f.file,
    );
    if (pendingFiles.length === 0) {
      const allSuccess =
        currentFiles.length > 0 &&
        currentFiles.every((f) => f.status === "success");
      if (allSuccess) {
        onUploadComplete();
        onClose();
        updateUploadFiles([]);
      }
      return;
    }

    isUploadingRef.current = true;

    updateUploadFiles((prev) =>
      prev.map((f) =>
        f.status === "pending" && f.file
          ? { ...f, status: "uploading", startTime: Date.now() }
          : f,
      ),
    );

    let hasNewSuccess = false;
    const totalPending = pendingFiles.length;

    await Promise.all(
      pendingFiles.map(async (uploadFile, index) => {
        if (!uploadFile.file) return;

        const file = uploadFile.file;
        const taskId = uploadFile.id;
        // 先添加的文件优先上传（列表中靠前的优先级更高）
        const priority = totalPending - index;

        const updateProgress = (progress: number, statusMessage?: string) => {
          updateUploadFiles((prev) =>
            prev.map((f) =>
              f.id === taskId
                ? {
                    ...f,
                    progress,
                    ...(statusMessage !== undefined && { statusMessage }),
                  }
                : f,
            ),
          );
        };

        try {
          await uploadQueue.add(
            taskId,
            () =>
              fileService.uploadFileWithInstant(file, updateProgress, folderId),
            { fileSize: file.size, priority },
          );

          updateUploadFiles((prev) =>
            prev.map((f) =>
              f.id === taskId ? { ...f, status: "success", progress: 100 } : f,
            ),
          );
          hasNewSuccess = true;
        } catch (err) {
          updateUploadFiles((prev) =>
            prev.map((f) =>
              f.id === taskId
                ? {
                    ...f,
                    status: "error",
                    error: getErrorMessage(err, "上传失败"),
                  }
                : f,
            ),
          );
        }
      }),
    );

    isUploadingRef.current = false;

    if (hasNewSuccess) {
      onUploadComplete();
    }
  }, [onUploadComplete, onClose, updateUploadFiles, folderId]);

  // 重试单个文件
  const handleRetry = useCallback(
    (id: string) => {
      updateUploadFiles((prev) =>
        prev.map((f) =>
          f.id === id && f.file
            ? { ...f, status: "pending", progress: 0, error: undefined }
            : f,
        ),
      );
    },
    [updateUploadFiles],
  );

  // 移除单个文件
  const handleRemove = useCallback(
    (id: string) => {
      updateUploadFiles((prev) => prev.filter((f) => f.id !== id));
    },
    [updateUploadFiles],
  );

  // 清空所有文件
  const handleClearAll = useCallback(() => {
    updateUploadFiles([]);
  }, [updateUploadFiles]);

  // 拖拽事件
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  // 关闭时清理（含 input）；有文件正在上传时不允许关闭
  const uploadStatsForClose = useMemo(
    () => uploadFiles.some((f) => f.status === "uploading"),
    [uploadFiles],
  );
  const handleClose = useCallback(() => {
    if (uploadStatsForClose) return;
    updateUploadFiles([]);
    setTotalLimitWarning("");
    setLargeLimitWarning("");
    setDuplicateWarning("");
    if (inputRef.current) inputRef.current.value = "";
    onClose();
  }, [onClose, updateUploadFiles, uploadStatsForClose]);

  const uploadStats = useMemo(
    () =>
      uploadFiles.reduce(
        (acc, f) => {
          if (f.status === "pending") {
            acc.pendingCount++;
            if (f.file) acc.pendingWithFile.push(f);
          }
          if (f.status === "uploading") acc.uploadingCount++;
          if (f.status === "success") acc.successCount++;
          if (f.file && isLargeFileForConcurrentLimit(f.file.size))
            acc.largeFileCount++;
          return acc;
        },
        {
          pendingCount: 0,
          uploadingCount: 0,
          successCount: 0,
          pendingWithFile: [] as UploadFile[],
          largeFileCount: 0,
        },
      ),
    [uploadFiles],
  );

  const isUploading = uploadStats.uploadingCount > 0;
  const hasPending = uploadStats.pendingCount > 0;
  const totalAtLimit = uploadFiles.length >= maxBatchCount;
  const largeAtLimit =
    uploadStats.largeFileCount >= LARGE_FILE_UPLOAD.MAX_CONCURRENT;

  // 完成按钮点击（使用 uploadStats 避免重复遍历）
  const handleAttach = useCallback(() => {
    if (hasPending) {
      startUpload();
    } else if (!isUploading) {
      if (uploadStats.successCount > 0) {
        onUploadComplete();
      }
      onClose();
      updateUploadFiles([]);
    }
  }, [
    hasPending,
    isUploading,
    uploadStats.successCount,
    startUpload,
    onUploadComplete,
    onClose,
    updateUploadFiles,
  ]);

  if (!open) return null;

  return (
    <div
      className="uploadDialogCyberBackdrop fixed inset-0 z-50 flex items-center justify-center bg-[var(--upload-backdrop)] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-dialog-title"
      data-oid=".7:8wip"
    >
      <div
        className="uploadDialogCyberSurface flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[var(--upload-surface-bg)] text-[var(--upload-text)] shadow-2xl animate-fade-in"
        data-oid="oz49qwv"
      >
        {/* 头部：固定，不参与滚动 */}
        <div className="flex-shrink-0 p-6 pb-0" data-oid="-5uz:9s">
          <div
            className="mb-1 flex items-center justify-between"
            data-oid="kbqfnqy"
          >
            <h2
              id="upload-dialog-title"
              className="font-brand text-lg font-normal tracking-widest text-[var(--upload-text)]"
              data-oid="zksxhi."
            >
              Upload Files
            </h2>
            <button
              type="button"
              onClick={handleClose}
              disabled={isUploading}
              aria-label="关闭"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--upload-text-muted)] transition-colors hover:bg-[var(--upload-control-hover)] hover:text-[var(--upload-text)] disabled:cursor-not-allowed disabled:opacity-50"
              data-oid="nrse-xn"
            >
              <CloseIcon data-oid="2v7ndiv" />
            </button>
          </div>
          <p
            className="font-brand mb-5 text-sm font-normal tracking-widest text-[var(--upload-text-muted)]"
            data-oid="oa-6jsg"
          >
            Uploaded project attachments
          </p>
        </div>

        {/* 中间：可滚动，避免把底部按钮顶出视野 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6" data-oid="5gs6vhm">
          {/* 拖拽区域 */}
          <UploadDropzone
            dragActive={dragActive}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onFilesSelect={appendFilesToState}
            open={open}
          />

          {/* URL 上传 */}
          <UploadUrlForm onFileAdd={handleUrlFileAdd} />

          {/* 上传进度列表 */}
          <UploadProgressList
            uploadFiles={uploadFiles}
            onRemoveFile={handleRemove}
            onRetryFile={handleRetry}
            onClearAll={handleClearAll}
            maxBatchCount={maxBatchCount}
            totalAtLimit={totalAtLimit}
            largeAtLimit={largeAtLimit}
            totalLimitWarning={totalLimitWarning}
            largeLimitWarning={largeLimitWarning}
            duplicateWarning={duplicateWarning}
          />
        </div>

        {/* 底部按钮：固定，始终在视野内 */}
        <div className="flex-shrink-0 p-6 pt-4" data-oid="9yo:.vp">
          <div className="flex gap-3" data-oid="3b-ji.z">
            <button
              type="button"
              onClick={handleClose}
              disabled={isUploading}
              className="uploadDialogCyberSecondaryBtn font-brand flex-1 rounded-lg bg-[var(--btn-secondary-bg)] px-4 py-2 text-sm font-normal tracking-widest text-[var(--btn-secondary-text)] transition-colors hover:bg-[var(--btn-secondary-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              data-oid="tq87jek"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAttach}
              disabled={
                uploadFiles.length === 0 || (isUploading && !hasPending)
              }
              className="uploadDialogCyberPrimaryBtn font-brand flex-1 rounded-lg bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-normal tracking-widest text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--btn-primary-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              data-oid="-49nfvp"
            >
              {hasPending
                ? "Start Upload"
                : isUploading
                  ? "Uploading..."
                  : "Attach files"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 关闭图标
function CloseIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      data-oid="gj1aoxz"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
        data-oid="-_l5jt3"
      />
    </svg>
  );
}


