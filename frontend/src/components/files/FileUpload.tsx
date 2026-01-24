import { useState, useCallback, useRef } from 'react';
import { fileService } from '../../services/files';
import { getErrorMessage } from '../../utils/error';
import {
  validateFile,
  getMaxFileSizeMB,
} from '../../utils/uploadValidation';
import { UploadQueue } from '../../utils/uploadQueue';
import ErrorMessage from '../common/ErrorMessage';
import Spinner from '../common/Spinner';
import { cn } from '../../utils/cn';

interface FileUploadProps {
  onUploadSuccess: () => void;
}

const uploadQueue = new UploadQueue(3); // Max 3 concurrent uploads

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );
  const uploadTasksRef = useRef<Set<string>>(new Set());

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const list = Array.from(files);
      const validationErrors: string[] = [];
      for (const f of list) {
        const r = validateFile(f);
        if (!r.ok) validationErrors.push(r.error);
      }
      if (validationErrors.length > 0) {
        setError(validationErrors.join('；'));
        return;
      }

      setUploading(true);
      setError(null);
      setUploadProgress(
        Object.fromEntries(list.map((f) => [f.name, 0]))
      );

      try {
        // Use upload queue for controlled concurrency
        await Promise.all(
          list.map((file) => {
            const taskId = `${file.name}-${Date.now()}`;
            uploadTasksRef.current.add(taskId);
            const useChunked = file.size >= fileService.CHUNK_THRESHOLD;
            const uploadTask = () =>
              useChunked
                ? fileService.uploadFileChunked(file, (p) => {
                    setUploadProgress((prev) => ({ ...prev, [file.name]: p }));
                  })
                : fileService.uploadFile(file, (p) => {
                    setUploadProgress((prev) => ({ ...prev, [file.name]: p }));
                  });
            return uploadQueue.add(taskId, uploadTask).finally(() => {
              uploadTasksRef.current.delete(taskId);
            });
          })
        );
        setUploadProgress({});
        onUploadSuccess();
      } catch (err) {
        setError(getErrorMessage(err, 'Upload failed'));
      } finally {
        setUploading(false);
        setUploadProgress({});
        uploadTasksRef.current.clear();
      }
    },
    [onUploadSuccess]
  );

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
      handleUpload(e.dataTransfer.files);
    },
    [handleUpload]
  );

  const maxMB = getMaxFileSizeMB();

  return (
    <div className="mb-8">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-12 text-center transition-all',
          dragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600 bg-gray-800/50'
        )}
      >
        <input
          type="file"
          id="file-upload"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
          disabled={uploading}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          {uploading ? (
            <Spinner size="lg" className="mb-4 border-purple-500/30 border-t-purple-400" />
          ) : (
            <svg
              className="w-16 h-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          )}
          <p className="text-lg font-medium text-white mb-2">
            {uploading ? '上传中…' : '拖拽文件到此处或点击选择'}
          </p>
          <p className="text-sm text-gray-400 mb-4">
            支持图片、PDF、文本、ZIP，单文件不超过 {maxMB}MB
          </p>
          <button
            type="button"
            disabled={uploading}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? '上传中…' : '选择文件'}
          </button>
        </label>
      </div>

      {Object.keys(uploadProgress).length > 0 && (
        <div className="mt-4 space-y-2">
          {Object.entries(uploadProgress).map(([name, pct]) => (
            <div key={name} className="flex items-center gap-3">
              <span className="text-sm text-gray-300 truncate flex-1 min-w-0">
                {name}
              </span>
              <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm text-gray-400 tabular-nums w-8">
                {pct}%
              </span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <ErrorMessage
          message={error}
          onClose={() => setError(null)}
          type="error"
        />
      )}
    </div>
  );
}
