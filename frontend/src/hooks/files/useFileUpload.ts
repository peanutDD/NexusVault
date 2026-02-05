import { useState, useCallback, useRef } from 'react';
import { fileService } from '../../services/files';
import { getErrorMessage } from '../../utils/error';
import { validateFile, getMaxBatchCount } from '../../utils/uploadValidation';
import { UPLOAD_QUEUE } from '../../constants';
import { UploadQueue } from '../../utils/uploadQueue';
import type { UploadFile } from '../../components/files/upload/UploadFileItem';

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

  // 添加文件
  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setBatchLimitWarning('');

      const currentFiles = uploadFilesRef.current;
      const remainingSlots = maxBatchCount - currentFiles.length;
      if (remainingSlots <= 0) {
        setBatchLimitWarning(`已达到单次上传上限 ${maxBatchCount} 个文件`);
        return;
      }

      const filesToAdd = files.slice(0, remainingSlots);
      const skippedCount = files.length - filesToAdd.length;
      if (skippedCount > 0) {
        setBatchLimitWarning(`已达到上限，${skippedCount} 个文件被跳过（最多 ${maxBatchCount} 个）`);
      }

      const baseId = Date.now();
      const newEntries: UploadFile[] = filesToAdd.map((file, index) => {
        const validation = validateFile(file);
        return {
          id: `upload-${baseId}-${index}-${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
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

  // 开始上传
  const startUpload = useCallback(async () => {
    if (isUploadingRef.current) return;

    const currentFiles = uploadFilesRef.current;
    const pendingFiles = currentFiles.filter((f) => f.status === 'pending' && f.file);
    if (pendingFiles.length === 0) return;

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
        const isVideo = file.type.startsWith('video/');
        const useChunked = isVideo || file.size >= fileService.CHUNK_THRESHOLD;
        const priority = totalPending - index;

        const updateProgress = (progress: number) => {
          updateUploadFiles((prev) =>
            prev.map((f) => (f.id === taskId ? { ...f, progress } : f))
          );
        };

        try {
          await uploadQueue.add(
            taskId,
            () =>
              useChunked
                ? fileService.uploadFileChunked(file, updateProgress)
                : fileService.uploadFile(file, updateProgress),
            { fileSize: file.size, priority }
          );

          updateUploadFiles((prev) =>
            prev.map((f) =>
              f.id === taskId ? { ...f, status: 'success', progress: 100 } : f
            )
          );
          hasNewSuccess = true;
        } catch (err) {
          updateUploadFiles((prev) =>
            prev.map((f) =>
              f.id === taskId
                ? { ...f, status: 'error', error: getErrorMessage(err, '上传失败') }
                : f
            )
          );
        }
      })
    );

    isUploadingRef.current = false;

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
      updateUploadFiles((prev) => prev.filter((f) => f.id !== id));
    },
    [updateUploadFiles]
  );

  // 清空文件
  const clearFiles = useCallback(() => {
    updateUploadFiles([]);
    setBatchLimitWarning('');
  }, [updateUploadFiles]);

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
