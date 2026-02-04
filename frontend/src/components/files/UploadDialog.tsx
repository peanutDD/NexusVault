import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { fileService } from '../../services/files';
import { getErrorMessage } from '../../utils/error';
import { validateFile, getMaxFileSizeGB, getMaxBatchCount } from '../../utils/uploadValidation';
import { UPLOAD_QUEUE } from '../../constants';
import { UploadQueue } from '../../utils/uploadQueue';
import { cn } from '../../utils/cn';
import UploadFileItem, { type UploadFile } from './UploadFileItem';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

const uploadQueue = new UploadQueue(
  UPLOAD_QUEUE.MAX_COST,
  UPLOAD_QUEUE.LARGE_FILE_THRESHOLD_BYTES
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
  const [dragActive, setDragActive] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isUploadingRef = useRef(false);
  // 用 ref 保存真实状态，绕过 React 18 StrictMode 双重调用导致的 prev 始终为初始值问题
  const uploadFilesRef = useRef<UploadFile[]>([]);
  
  // 封装 setState，同时更新 ref 和 state
  const updateUploadFiles = useCallback((updater: UploadFile[] | ((prev: UploadFile[]) => UploadFile[])) => {
    const newValue = typeof updater === 'function' ? updater(uploadFilesRef.current) : updater;
    uploadFilesRef.current = newValue;
    setUploadFiles(newValue);
  }, []);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const maxBatchCount = getMaxBatchCount();
  const [batchLimitWarning, setBatchLimitWarning] = useState('');

  /** 唯一写入口：把 File[] 追加到上传列表（拖拽与点选都经此） */
  const appendFilesToState = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setBatchLimitWarning('');
      
      // 使用 ref 获取真实的当前状态，绕过 StrictMode 双重调用问题
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
      
      // 使用 wrapper 同时更新 ref 和 state
      updateUploadFiles([...currentFiles, ...newEntries]);
    },
    [maxBatchCount, updateUploadFiles]
  );

  /** 拖拽：直接传 FileList，转数组后追加 */
  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      appendFilesToState(Array.from(fileList));
    },
    [appendFilesToState]
  );

  // 打开弹窗时清空 input 并强制 multiple，避免部分环境不认 JSX 的 multiple
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.setAttribute('multiple', '');
    }
  }, [open]);

  // 开始上传所有 pending 文件
  const startUpload = useCallback(async () => {
    if (isUploadingRef.current) return;

    // 使用 ref 获取最新状态，避免闭包捕获旧的 uploadFiles
    const currentFiles = uploadFilesRef.current;
    const pendingFiles = currentFiles.filter((f) => f.status === 'pending' && f.file);
    if (pendingFiles.length === 0) {
      const allSuccess = currentFiles.length > 0 && currentFiles.every((f) => f.status === 'success');
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
        const useChunked = file.size >= fileService.CHUNK_THRESHOLD;
        // 先添加的文件优先上传（列表中靠前的优先级更高）
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
      onUploadComplete();
    }
  }, [onUploadComplete, onClose, updateUploadFiles]);

  // 重试单个文件
  const handleRetry = useCallback((id: string) => {
    updateUploadFiles((prev) =>
      prev.map((f) =>
        f.id === id && f.file
          ? { ...f, status: 'pending', progress: 0, error: undefined }
          : f
      )
    );
  }, [updateUploadFiles]);

  // 移除单个文件
  const handleRemove = useCallback((id: string) => {
    updateUploadFiles((prev) => prev.filter((f) => f.id !== id));
  }, [updateUploadFiles]);

  // URL 上传 - 获取详细错误信息
  const getUrlErrorMessage = useCallback((err: unknown, url: string): string => {
    // URL 格式无效
    if (err instanceof TypeError && err.message.includes('URL')) {
      return `URL 格式无效: "${url}"。请输入完整的 URL，例如 https://example.com/file.jpg`;
    }
    
    // fetch 错误
    if (err instanceof TypeError) {
      // CORS 或网络错误通常表现为 TypeError: Failed to fetch
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        return `无法访问该 URL。可能的原因：
• 目标服务器不允许跨域请求 (CORS)
• URL 地址不存在或无法访问
• 网络连接问题`;
      }
      return `网络请求失败: ${err.message}`;
    }
    
    // HTTP 错误
    if (err instanceof Error) {
      const httpMatch = err.message.match(/^HTTP (\d+)(?:\s*-\s*(.+))?$/);
      if (httpMatch) {
        const status = parseInt(httpMatch[1], 10);
        const statusMessages: Record<number, string> = {
          400: '请求无效',
          401: '需要身份验证',
          403: '访问被拒绝（无权限）',
          404: '文件不存在',
          405: '请求方法不允许',
          408: '请求超时',
          410: '资源已被删除',
          429: '请求过于频繁',
          500: '服务器内部错误',
          502: '网关错误',
          503: '服务暂时不可用',
          504: '网关超时',
        };
        const statusText = statusMessages[status] || '请求失败';
        return `下载失败 (HTTP ${status}): ${statusText}`;
      }
      return err.message;
    }
    
    return 'URL 下载失败，请检查地址是否正确';
  }, []);

  // URL 上传
  const handleUrlUpload = useCallback(async () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) return;

    setUrlLoading(true);
    try {
      // 验证 URL 格式
      let urlObj: URL;
      try {
        urlObj = new URL(trimmedUrl);
      } catch {
        throw new TypeError(`Invalid URL: ${trimmedUrl}`);
      }
      
      // 验证协议
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error(`不支持的协议: ${urlObj.protocol}。仅支持 http:// 和 https://`);
      }
      
      const pathname = urlObj.pathname;
      const filename = decodeURIComponent(pathname.split('/').pop() || 'downloaded-file');

      // 使用 AbortController 设置超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      let response: Response;
      try {
        response = await fetch(trimmedUrl, { 
          signal: controller.signal,
          mode: 'cors',
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          throw new Error('HTTP 408 - 请求超时（超过30秒）');
        }
        throw fetchErr;
      }
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // 检查是否下载到有效内容
      if (blob.size === 0) {
        throw new Error('下载的文件为空');
      }
      
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

      updateUploadFiles((prev) => [...prev, uploadFile]);
      setUrlInput('');
    } catch (err) {
      const errorFile: UploadFile = {
        id: `url-error-${Date.now()}`,
        name: trimmedUrl.length > 50 ? trimmedUrl.slice(0, 50) + '...' : trimmedUrl,
        size: 0,
        mimeType: 'unknown',
        status: 'error',
        progress: 0,
        error: getUrlErrorMessage(err, trimmedUrl),
      };
      updateUploadFiles((prev) => [...prev, errorFile]);
    } finally {
      setUrlLoading(false);
    }
  }, [urlInput, getUrlErrorMessage, updateUploadFiles]);

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

  // 关闭时清理（含 input，便于下次选择不残留）
  const handleClose = useCallback(() => {
    if (!isUploadingRef.current) {
      updateUploadFiles([]);
      setUrlInput('');
      setBatchLimitWarning('');
      if (inputRef.current) inputRef.current.value = '';
      onClose();
    }
  }, [onClose, updateUploadFiles]);

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
      updateUploadFiles([]);
    }
  }, [hasPending, isUploading, uploadStats.successCount, startUpload, onUploadComplete, onClose, updateUploadFiles]);

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
        {/* 标题栏：与导航栏标题字体一致 */}
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-brand text-lg font-normal tracking-widest text-white">Upload Files</h2>
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
        <p className="font-brand mb-5 text-sm font-normal tracking-widest text-gray-500">Uploaded project attachments</p>

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
              const list = e.target.files;
              if (!list || list.length === 0) return;
              appendFilesToState(Array.from(list));
              setTimeout(() => {
                if (inputRef.current) inputRef.current.value = '';
              }, 0);
            }}
          />

          {/* 文件图标 - 带折角的文档样式 */}
          <div className="mb-4">
            <FileDocIcon />
          </div>

          <p className="font-brand mb-1 text-sm font-normal tracking-widest text-white">
            Drag and drop your files
          </p>
          <p className="font-brand mb-5 text-xs font-normal tracking-widest text-gray-500">
            Max. File size: {(maxGB > 1) ? `${maxGB} GB` : `${Math.round(maxGB * 1024)} MB`}
          </p>

          <button
            type="button"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.value = '';
                inputRef.current.click();
              }
            }}
            className="font-brand rounded-lg bg-[#2A2A3C] px-5 py-2.5 text-sm font-normal tracking-widest text-white transition-colors hover:bg-[#3A3A4D]"
          >
            Select files
          </button>
          <p className="font-brand mt-2 text-xs text-gray-500">
            支持多选；若多选只显示 1 个，请将多个文件<strong>拖入上方区域</strong>，或多次点击「Select files」逐个添加
          </p>
        </div>

        {/* URL 上传 */}
        <div className="mb-5">
          <p className="font-brand mb-2 text-sm font-normal tracking-widest text-gray-500">Or upload from URL</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Add file URL"
              className={cn(
                'font-brand flex-1 rounded-lg border bg-transparent px-4 py-2.5 text-sm font-normal tracking-widest text-white placeholder-gray-600 transition-colors focus:outline-none',
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
              className="font-brand rounded-lg bg-[#6C5DD3] px-5 py-2.5 text-sm font-normal tracking-widest text-white transition-colors hover:bg-[#7C6DE3] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {urlLoading ? '...' : 'Upload'}
            </button>
          </div>
        </div>

        {/* 批量限制警告 */}
        {batchLimitWarning && (
          <div className="font-brand mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-normal tracking-widest text-amber-400">
            {batchLimitWarning}
          </div>
        )}

        {/* 已上传文件列表 */}
        {uploadFiles.length > 0 && (
          <div className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-brand text-sm font-normal tracking-widest text-white">Uploaded Files</p>
              <span className="font-brand text-xs font-normal tracking-widest text-gray-500">{uploadFiles.length} / {maxBatchCount}</span>
            </div>
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
            className="font-brand flex-1 rounded-full bg-[#2A2A3C] py-3 text-sm font-normal tracking-widest text-white transition-colors hover:bg-[#3A3A4D] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAttach}
            disabled={uploadFiles.length === 0 || isUploading}
            className="font-brand flex-1 rounded-full bg-[#6C5DD3] py-3 text-sm font-normal tracking-widest text-white transition-colors hover:bg-[#7C6DE3] disabled:cursor-not-allowed disabled:opacity-50"
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
