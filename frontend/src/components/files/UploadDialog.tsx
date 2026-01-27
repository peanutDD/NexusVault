import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { fileService } from '../../services/files';
import { getErrorMessage } from '../../utils/error';
import { validateFile, getMaxFileSizeGB } from '../../utils/uploadValidation';
import { UploadQueue } from '../../utils/uploadQueue';
import { cn } from '../../utils/cn';
import UploadFileItem, { type UploadFile } from './UploadFileItem';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

const uploadQueue = new UploadQueue(3);

/**
 * 上传对话框组件
 * 完美复刻设计稿的布局、配色、比例
 */
export default function UploadDialog({
  open,
  onClose,
  onUploadComplete,
}: UploadDialogProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isUploadingRef = useRef(false);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 添加文件到上传列表
  const addFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: UploadFile[] = Array.from(files).map((file) => {
      const validation = validateFile(file);
      return {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        status: validation.ok ? 'pending' : 'error',
        progress: 0,
        error: validation.ok ? undefined : validation.error,
        file: validation.ok ? file : undefined,
      };
    });

    setUploadFiles((prev) => [...prev, ...newFiles]);
  }, []);

  // 开始上传所有 pending 文件
  const startUpload = useCallback(async () => {
    if (isUploadingRef.current) return;

    // 使用已计算的 uploadStats.pendingWithFile
    const pendingFiles = uploadFiles.filter((f) => f.status === 'pending' && f.file);
    if (pendingFiles.length === 0) {
      const allSuccess = uploadFiles.length > 0 && uploadFiles.every((f) => f.status === 'success');
      if (allSuccess) {
        onUploadComplete();
        onClose();
        setUploadFiles([]);
      }
      return;
    }

    isUploadingRef.current = true;

    setUploadFiles((prev) =>
      prev.map((f) =>
        f.status === 'pending' && f.file
          ? { ...f, status: 'uploading', startTime: Date.now() }
          : f
      )
    );

    let hasNewSuccess = false;

    await Promise.all(
      pendingFiles.map(async (uploadFile) => {
        if (!uploadFile.file) return;

        const file = uploadFile.file;
        const taskId = uploadFile.id;
        const useChunked = file.size >= fileService.CHUNK_THRESHOLD;

        const updateProgress = (progress: number) => {
          setUploadFiles((prev) =>
            prev.map((f) => (f.id === taskId ? { ...f, progress } : f))
          );
        };

        try {
          await uploadQueue.add(taskId, () =>
            useChunked
              ? fileService.uploadFileChunked(file, updateProgress)
              : fileService.uploadFile(file, updateProgress)
          );

          setUploadFiles((prev) =>
            prev.map((f) =>
              f.id === taskId ? { ...f, status: 'success', progress: 100 } : f
            )
          );
          hasNewSuccess = true;
        } catch (err) {
          setUploadFiles((prev) =>
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
      onUploadComplete();
    }
  }, [uploadFiles, onUploadComplete, onClose]);

  // 重试单个文件
  const handleRetry = useCallback((id: string) => {
    setUploadFiles((prev) =>
      prev.map((f) =>
        f.id === id && f.file
          ? { ...f, status: 'pending', progress: 0, error: undefined }
          : f
      )
    );
  }, []);

  // 移除单个文件
  const handleRemove = useCallback((id: string) => {
    setUploadFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // URL 上传
  const handleUrlUpload = useCallback(async () => {
    if (!urlInput.trim()) return;

    setUrlLoading(true);
    try {
      const urlObj = new URL(urlInput);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'downloaded-file';

      const response = await fetch(urlInput);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const file = new File([blob], filename, { type: blob.type });

      const validation = validateFile(file);
      const uploadFile: UploadFile = {
        id: `url-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: filename,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        status: validation.ok ? 'pending' : 'error',
        progress: 0,
        error: validation.ok ? undefined : validation.error,
        file: validation.ok ? file : undefined,
      };

      setUploadFiles((prev) => [...prev, uploadFile]);
      setUrlInput('');
    } catch (err) {
      const errorFile: UploadFile = {
        id: `url-error-${Date.now()}`,
        name: urlInput,
        size: 0,
        mimeType: 'unknown',
        status: 'error',
        progress: 0,
        error: getErrorMessage(err, 'URL 下载失败'),
      };
      setUploadFiles((prev) => [...prev, errorFile]);
    } finally {
      setUrlLoading(false);
    }
  }, [urlInput]);

  // 拖拽事件
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
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
    [addFiles]
  );

  // 关闭时清理
  const handleClose = useCallback(() => {
    if (!isUploadingRef.current) {
      setUploadFiles([]);
      setUrlInput('');
      onClose();
    }
  }, [onClose]);

  const maxGB = getMaxFileSizeGB();
  
  // 使用 useMemo + reduce 合并多个 filter/some 为单次遍历（放在 handleAttach 之前）
  const uploadStats = useMemo(() => uploadFiles.reduce(
    (acc, f) => {
      if (f.status === 'pending') {
        acc.pendingCount++;
        if (f.file) acc.pendingWithFile.push(f);
      }
      if (f.status === 'uploading') acc.uploadingCount++;
      if (f.status === 'success') acc.successCount++;
      return acc;
    },
    { pendingCount: 0, uploadingCount: 0, successCount: 0, pendingWithFile: [] as UploadFile[] }
  ), [uploadFiles]);
  
  const isUploading = uploadStats.uploadingCount > 0;
  const hasPending = uploadStats.pendingCount > 0;

  // 完成按钮点击（使用 uploadStats 避免重复遍历）
  const handleAttach = useCallback(() => {
    if (hasPending) {
      startUpload();
    } else if (!isUploading) {
      if (uploadStats.successCount > 0) {
        onUploadComplete();
      }
      onClose();
      setUploadFiles([]);
    }
  }, [hasPending, isUploading, uploadStats.successCount, startUpload, onUploadComplete, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md animate-fade-in rounded-2xl bg-[#1C1C28] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Upload Files</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            aria-label="关闭"
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CloseIcon />
          </button>
        </div>
        <p className="mb-5 text-sm text-gray-500">Uploaded project attachments</p>

        {/* 拖拽区域 */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            'relative mb-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition-all duration-200',
            dragActive
              ? 'border-[#6C5DD3] bg-[#6C5DD3]/10'
              : 'border-[#3A3A4D] hover:border-[#4A4A5D]'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            aria-label="选择文件"
            onChange={(e) => {
              addFiles(e.target.files);
              if (inputRef.current) inputRef.current.value = '';
            }}
          />

          {/* 文件图标 - 带折角的文档样式 */}
          <div className="mb-4">
            <FileDocIcon />
          </div>

          <p className="mb-1 text-sm font-medium text-white">
            Drag and drop your files
          </p>
          <p className="mb-5 text-xs text-gray-500">
            Max. File size: {maxGB > 1 ? `${maxGB} GB` : `${Math.round(maxGB * 1024)} MB`}
          </p>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-[#2A2A3C] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3A3A4D]"
          >
            Select files
          </button>
        </div>

        {/* URL 上传 */}
        <div className="mb-5">
          <p className="mb-2 text-sm text-gray-500">Or upload from URL</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Add file URL"
              className={cn(
                'flex-1 rounded-lg border bg-transparent px-4 py-2.5 text-sm text-white placeholder-gray-600 transition-colors focus:outline-none',
                urlInput.trim()
                  ? 'border-[#6C5DD3]'
                  : 'border-[#2A2A3C] focus:border-[#6C5DD3]'
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUrlUpload();
              }}
            />
            <button
              type="button"
              onClick={handleUrlUpload}
              disabled={!urlInput.trim() || urlLoading}
              className="rounded-lg bg-[#6C5DD3] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#7C6DE3] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {urlLoading ? '...' : 'Upload'}
            </button>
          </div>
        </div>

        {/* 已上传文件列表 */}
        {uploadFiles.length > 0 && (
          <div className="mb-5">
            <p className="mb-3 text-sm font-medium text-white">Uploaded Files</p>
            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {uploadFiles.map((file) => (
                <UploadFileItem
                  key={file.id}
                  file={file}
                  onRemove={handleRemove}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          </div>
        )}

        {/* 底部按钮 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="flex-1 rounded-full bg-[#2A2A3C] py-3 text-sm font-medium text-white transition-colors hover:bg-[#3A3A4D] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAttach}
            disabled={uploadFiles.length === 0 || isUploading}
            className="flex-1 rounded-full bg-[#6C5DD3] py-3 text-sm font-medium text-white transition-colors hover:bg-[#7C6DE3] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading
              ? 'Uploading...'
              : hasPending
                ? 'Start Upload'
                : 'Attach files'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 关闭图标
function CloseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

// 文件文档图标（带折角）
function FileDocIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 文档主体 */}
      <path
        d="M12 6C12 4.89543 12.8954 4 14 4H28L36 12V42C36 43.1046 35.1046 44 34 44H14C12.8954 44 12 43.1046 12 42V6Z"
        fill="#6C5DD3"
      />
      {/* 折角 */}
      <path
        d="M28 4L36 12H30C28.8954 12 28 11.1046 28 10V4Z"
        fill="#9B8FE8"
      />
    </svg>
  );
}
