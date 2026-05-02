import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fileService } from "../../../services/files";
import { LARGE_FILE_UPLOAD, UPLOAD_QUEUE } from "../../../constants";
import { getErrorMessage } from "../../../utils/error";
import { UploadQueue } from "../../../utils/uploadQueue";
import {
  getMaxBatchCount,
  isLargeFileForConcurrentLimit,
} from "../../../utils/uploadValidation";
import type { UploadFile } from "./UploadFileItem";
import {
  closeIfAllSuccess,
  fileDedupKey,
  getUploadStats,
  handleDragEvent,
  retryFile,
  toUploadFile,
  updateLimitWarnings,
} from "./uploadDialogControllerUtils";

const uploadQueue = new UploadQueue(
  UPLOAD_QUEUE.MAX_COST,
  UPLOAD_QUEUE.LARGE_FILE_THRESHOLD_BYTES,
);

interface UseUploadDialogControllerArgs {
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

export function useUploadDialogController({
  open,
  onClose,
  onUploadComplete,
}: UseUploadDialogControllerArgs) {
  const [searchParams] = useSearchParams();
  const [dragActive, setDragActive] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [totalLimitWarning, setTotalLimitWarning] = useState("");
  const [largeLimitWarning, setLargeLimitWarning] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isUploadingRef = useRef(false);
  const uploadFilesRef = useRef<UploadFile[]>([]);
  const maxBatchCount = getMaxBatchCount();
  const folderId = searchParams.get("folder") || null;

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

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.setAttribute("multiple", "");
    }
  }, [open]);

  const clearWarnings = useCallback(() => {
    setTotalLimitWarning("");
    setLargeLimitWarning("");
    setDuplicateWarning("");
  }, []);

  const appendFilesToState = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      clearWarnings();

      const currentFiles = uploadFilesRef.current;
      const currentKeys = new Set(
        currentFiles.filter((f) => f.file).map((f) => fileDedupKey(f.file!)),
      );
      const seen = new Set<string>();
      const deduped: File[] = [];
      let duplicateCount = 0;

      for (const file of files) {
        const key = fileDedupKey(file);
        if (currentKeys.has(key) || seen.has(key)) duplicateCount++;
        else {
          seen.add(key);
          deduped.push(file);
        }
      }

      if (duplicateCount > 0) {
        setDuplicateWarning(`已忽略 ${duplicateCount} 个重复文件（同名同大小）`);
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
      const largeFiles = deduped.filter((f) =>
        isLargeFileForConcurrentLimit(f.size),
      );
      const smallFiles = deduped.filter(
        (f) => !isLargeFileForConcurrentLimit(f.size),
      );
      const largeToAdd = largeFiles.slice(0, Math.max(0, remainingLargeSlots));
      const smallToAdd = smallFiles.slice(
        0,
        Math.max(0, remainingTotalSlots - largeToAdd.length),
      );
      const filesToAdd = [...largeToAdd, ...smallToAdd].slice(
        0,
        remainingTotalSlots,
      );

      updateLimitWarnings({
        dedupedCount: deduped.length,
        filesToAddCount: filesToAdd.length,
        largeSkipped: largeFiles.length - largeToAdd.length,
        smallSkipped: smallFiles.length - smallToAdd.length,
        maxBatchCount,
        setLargeLimitWarning,
        setTotalLimitWarning,
      });

      const baseId = Date.now();
      const newEntries = filesToAdd.map((file, index) =>
        toUploadFile(file, baseId, index),
      );
      updateUploadFiles([...currentFiles, ...newEntries]);
    },
    [clearWarnings, maxBatchCount, updateUploadFiles],
  );

  const handleUrlFileAdd = useCallback(
    (uploadFile: UploadFile) => {
      updateUploadFiles((prev) => [...prev, uploadFile]);
    },
    [updateUploadFiles],
  );

  const startUpload = useCallback(async () => {
    const currentFiles = uploadFilesRef.current;
    const pendingFiles = currentFiles.filter(
      (f) => f.status === "pending" && f.file,
    );
    if (pendingFiles.length === 0) {
      closeIfAllSuccess(currentFiles, onUploadComplete, onClose, updateUploadFiles);
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
    await Promise.all(
      pendingFiles.map(async (uploadFile, index) => {
        if (!uploadFile.file) return;
        const taskId = uploadFile.id;
        const priority = pendingFiles.length - index;
        const updateProgress = (progress: number, statusMessage?: string) => {
          updateUploadFiles((prev) =>
            prev.map((f) =>
              f.id === taskId
                ? { ...f, progress, ...(statusMessage !== undefined && { statusMessage }) }
                : f,
            ),
          );
        };

        try {
          await uploadQueue.add(
            taskId,
            () =>
              fileService.uploadFileWithInstant(
                uploadFile.file!,
                updateProgress,
                folderId,
              ),
            { fileSize: uploadFile.file.size, priority },
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
                ? { ...f, status: "error", error: getErrorMessage(err, "上传失败") }
                : f,
            ),
          );
        }
      }),
    );

    isUploadingRef.current = false;
    if (hasNewSuccess) onUploadComplete();
  }, [folderId, onClose, onUploadComplete, updateUploadFiles]);

  const uploadStats = useMemo(() => getUploadStats(uploadFiles), [uploadFiles]);
  const isUploading = uploadStats.uploadingCount > 0;
  const hasPending = uploadStats.pendingCount > 0;
  const totalAtLimit = uploadFiles.length >= maxBatchCount;
  const largeAtLimit =
    uploadStats.largeFileCount >= LARGE_FILE_UPLOAD.MAX_CONCURRENT;

  const handleClose = useCallback(() => {
    if (isUploading) return;
    updateUploadFiles([]);
    clearWarnings();
    if (inputRef.current) inputRef.current.value = "";
    onClose();
  }, [clearWarnings, isUploading, onClose, updateUploadFiles]);

  const handleAttach = useCallback(() => {
    if (hasPending) void startUpload();
    else if (!isUploading) {
      if (uploadStats.successCount > 0) onUploadComplete();
      onClose();
      updateUploadFiles([]);
    }
  }, [hasPending, isUploading, onClose, onUploadComplete, startUpload, uploadStats.successCount, updateUploadFiles]);

  return {
    dragActive,
    uploadFiles,
    maxBatchCount,
    totalLimitWarning,
    largeLimitWarning,
    duplicateWarning,
    totalAtLimit,
    largeAtLimit,
    isUploading,
    hasPending,
    appendFilesToState,
    handleUrlFileAdd,
    handleRetry: (id: string) => updateUploadFiles((prev) => retryFile(prev, id)),
    handleRemove: (id: string) => updateUploadFiles((prev) => prev.filter((f) => f.id !== id)),
    handleClearAll: () => updateUploadFiles([]),
    handleDrag: (e: React.DragEvent) => handleDragEvent(e, setDragActive),
    handleDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      appendFilesToState(Array.from(e.dataTransfer.files));
    },
    handleClose,
    handleAttach,
  };
}
