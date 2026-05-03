import { useEffect, useState, useCallback, useRef } from 'react';
import { fileService } from '../../services/files';
import { getErrorMessage } from '../../utils/error';
import {
  getUploadMimeType,
  validateFile,
  getMaxBatchCount,
  isLargeFileForConcurrentLimit,
} from '../../utils/uploadValidation';
import { UPLOAD_QUEUE, LARGE_FILE_UPLOAD } from '../../constants';
import { UploadQueue } from '../../utils/uploadQueue';
import type { UploadFile } from '../../components/files/upload/UploadFileItem';
import { trackEvent, trackError } from '../../utils/telemetry';

const uploadQueue = new UploadQueue(
  UPLOAD_QUEUE.MAX_COST,
  UPLOAD_QUEUE.LARGE_FILE_THRESHOLD_BYTES
);

interface UseFileUploadReturn {
  /** 上传文件列表 */
  uploadFiles: UploadFile[];
  /** 是否正在上传 */
  isUploading: boolean;
  /** 是否有待上传文件 */
  hasPending: boolean;
  /** 成功上传数量 */
  successCount: number;
  /** 批量限制警告 */
  batchLimitWarning: string;
  /** 最大批量数量 */
  maxBatchCount: number;
  /** 添加文件 */
  addFiles: (files: File[]) => void;
  /** 添加单个上传文件（如 URL 上传） */
  addUploadFile: (file: UploadFile) => void;
  /** 开始上传 */
  startUpload: () => Promise<void>;
  /** 重试文件 */
  retryFile: (id: string) => void;
  /** 移除文件 */
  removeFile: (id: string) => void;
  /** 清空所有文件 */
  clearFiles: () => void;
}

/**
 * 文件上传逻辑 Hook
 */
export function useFileUpload(
  onUploadComplete?: () => void
): UseFileUploadReturn {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [batchLimitWarning, setBatchLimitWarning] = useState('');
  const isUploadingRef = useRef(false);
  const uploadFilesRef = useRef<UploadFile[]>([]);
  const abortControllersRef = useRef(new Map<string, AbortController>());
  const cancelledIdsRef = useRef(new Set<string>());
  const maxBatchCount = getMaxBatchCount();

  // 同步更新 ref 和 state
  const updateUploadFiles = useCallback(
    (updater: UploadFile[] | ((prev: UploadFile[]) => UploadFile[])) => {
      const newValue = typeof updater === 'function' ? updater(uploadFilesRef.current) : updater;
      uploadFilesRef.current = newValue;
      setUploadFiles(newValue);
    },
    []
  );

  const fileDedupKey = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

  const cancelUploadTask = useCallback((id: string) => {
    cancelledIdsRef.current.add(id);
    abortControllersRef.current.get(id)?.abort();
    uploadQueue.cancel(id);
  }, []);

  const cancelAllUploads = useCallback(() => {
    for (const file of uploadFilesRef.current) {
      if (file.status === 'pending' || file.status === 'uploading') {
        cancelledIdsRef.current.add(file.id);
      }
    }
    for (const controller of abortControllersRef.current.values()) {
      controller.abort();
    }
    uploadQueue.clear();
  }, []);

  useEffect(() => {
    return () => cancelAllUploads();
  }, [cancelAllUploads]);

  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setBatchLimitWarning('');

      const currentFiles = uploadFilesRef.current;
      const currentKeys = new Set(
        currentFiles.filter((f) => f.file).map((f) => fileDedupKey(f.file!))
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
      if (deduped.length === 0) {
        if (duplicateCount > 0) {
          setBatchLimitWarning(`已忽略 ${duplicateCount} 个重复文件（同名同大小）`);
        }
        return;
      }

      const currentLargeCount = currentFiles.filter(
        (f) => f.file && isLargeFileForConcurrentLimit(f.file.size)
      ).length;
      const remainingTotalSlots = maxBatchCount - currentFiles.length;
      if (remainingTotalSlots <= 0) {
        setBatchLimitWarning(`单次最多 ${maxBatchCount} 个文件，当前已满。请先完成或取消后再添加。`);
        return;
      }

      const remainingLargeSlots = LARGE_FILE_UPLOAD.MAX_CONCURRENT - currentLargeCount;
      const [largeFiles, smallFiles] = [
        deduped.filter((f) => isLargeFileForConcurrentLimit(f.size)),
        deduped.filter((f) => !isLargeFileForConcurrentLimit(f.size)),
      ];
      const largeToAdd = largeFiles.slice(0, Math.max(0, remainingLargeSlots));
      const largeSkipped = largeFiles.length - largeToAdd.length;
      const smallToAdd = smallFiles.slice(0, Math.max(0, remainingTotalSlots - largeToAdd.length));
      const filesToAdd = [...largeToAdd, ...smallToAdd].slice(0, remainingTotalSlots);

      const totalSkipped = deduped.length - filesToAdd.length;
      const totalMsg =
        totalSkipped > 0
          ? `单次最多 ${maxBatchCount} 个文件（含大文件），${totalSkipped} 个文件未添加。`
          : '';
      const largeMsg =
        largeSkipped > 0
          ? `大文件（≥100MB）最多 ${LARGE_FILE_UPLOAD.MAX_CONCURRENT} 个，${largeSkipped} 个大文件未添加。请先完成或取消后再添加。`
          : '';
      const dupMsg =
        duplicateCount > 0 ? `已忽略 ${duplicateCount} 个重复文件（同名同大小）。` : '';
      setBatchLimitWarning([dupMsg, totalMsg, largeMsg].filter(Boolean).join('\n'));

      const baseId = Date.now();
      const newEntries: UploadFile[] = filesToAdd.map((file, index) => {
        const validation = validateFile(file);
        return {
          id: `upload-${baseId}-${index}-${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          size: file.size,
          mimeType: getUploadMimeType(file),
          status: validation.ok ? 'pending' : 'error',
          progress: 0,
          error: validation.ok ? undefined : validation.error,
          file: validation.ok ? file : undefined,
        };
      });

      updateUploadFiles([...currentFiles, ...newEntries]);
    },
    [maxBatchCount, updateUploadFiles]
  );

  // 添加单个上传文件
  const addUploadFile = useCallback(
    (file: UploadFile) => {
      updateUploadFiles((prev) => [...prev, file]);
    },
    [updateUploadFiles]
  );

  // 开始上传（可多次点击：已有文件上传中时，新加入的 pending 可再次点击开始）
  const startUpload = useCallback(async () => {
    const currentFiles = uploadFilesRef.current;
    const pendingFiles = currentFiles.filter((f) => f.status === 'pending' && f.file);
    if (pendingFiles.length === 0) return;

    // 批量上传起点事件
    const totalSize = pendingFiles.reduce(
      (sum, f) => sum + (f.file ? f.file.size : 0),
      0
    );
    trackEvent({
      eventType: 'upload',
      action: 'upload_batch_start',
      status: 'start',
      fileSize: totalSize,
      extra: { count: pendingFiles.length },
    });

    isUploadingRef.current = true;

    updateUploadFiles((prev) =>
      prev.map((f) =>
        f.status === 'pending' && f.file
          ? { ...f, status: 'uploading', startTime: Date.now() }
          : f
      )
    );

    let hasNewSuccess = false;
    const totalPending = pendingFiles.length;

    await Promise.all(
      pendingFiles.map(async (uploadFile, index) => {
        if (!uploadFile.file) return;

        const file = uploadFile.file;
        const taskId = uploadFile.id;
        const priority = totalPending - index;
        const controller = new AbortController();
        abortControllersRef.current.set(taskId, controller);

        const updateProgress = (progress: number, statusMessage?: string) => {
          if (cancelledIdsRef.current.has(taskId)) return;
          updateUploadFiles((prev) =>
            prev.map((f) =>
              f.id === taskId
                ? { ...f, progress, ...(statusMessage !== undefined && { statusMessage }) }
                : f
            )
          );
        };

        try {
          await uploadQueue.add(
            taskId,
            () =>
              fileService.uploadFileWithInstant(file, updateProgress, null, {
                signal: controller.signal,
              }),
            { fileSize: file.size, priority }
          );

          if (cancelledIdsRef.current.has(taskId) || controller.signal.aborted) return;

          updateUploadFiles((prev) =>
            prev.map((f) =>
              f.id === taskId
                ? { ...f, status: 'success', progress: 100, statusMessage: undefined }
                : f
            )
          );
          hasNewSuccess = true;
        } catch (err) {
          if (cancelledIdsRef.current.has(taskId) || controller.signal.aborted) return;
          trackError(err, {
            action: 'upload_file',
            fileSize: file.size,
            extra: { taskId },
          });
          updateUploadFiles((prev) =>
            prev.map((f) =>
              f.id === taskId
                ? { ...f, status: 'error', error: getErrorMessage(err, '上传失败') }
                : f
            )
          );
        } finally {
          abortControllersRef.current.delete(taskId);
          cancelledIdsRef.current.delete(taskId);
        }
      })
    );

    isUploadingRef.current = uploadFilesRef.current.some((f) => f.status === 'uploading');

    if (hasNewSuccess) {
      onUploadComplete?.();
    }
  }, [onUploadComplete, updateUploadFiles]);

  // 重试文件
  const retryFile = useCallback(
    (id: string) => {
      updateUploadFiles((prev) =>
        prev.map((f) =>
          f.id === id && f.file
            ? { ...f, status: 'pending', progress: 0, error: undefined }
            : f
        )
      );
    },
    [updateUploadFiles]
  );

  // 移除文件
  const removeFile = useCallback(
    (id: string) => {
      const file = uploadFilesRef.current.find((item) => item.id === id);
      if (file?.status === 'pending' || file?.status === 'uploading') {
        cancelUploadTask(id);
      }
      updateUploadFiles((prev) => prev.filter((f) => f.id !== id));
    },
    [cancelUploadTask, updateUploadFiles]
  );

  // 清空文件
  const clearFiles = useCallback(() => {
    cancelAllUploads();
    updateUploadFiles([]);
    setBatchLimitWarning('');
  }, [cancelAllUploads, updateUploadFiles]);

  // 计算状态
  const uploadingCount = uploadFiles.filter((f) => f.status === 'uploading').length;
  const pendingCount = uploadFiles.filter((f) => f.status === 'pending').length;
  const successCount = uploadFiles.filter((f) => f.status === 'success').length;

  return {
    uploadFiles,
    isUploading: uploadingCount > 0,
    hasPending: pendingCount > 0,
    successCount,
    batchLimitWarning,
    maxBatchCount,
    addFiles,
    addUploadFile,
    startUpload,
    retryFile,
    removeFile,
    clearFiles,
  };
}

export default useFileUpload;
