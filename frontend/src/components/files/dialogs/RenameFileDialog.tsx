import { useState, useCallback, useEffect, useRef } from 'react';
import type { FileMetadata } from '../../../types/files';
import { getErrorMessage } from '../../../utils/error';
import { useDialog } from '../../../hooks/common/useDialog';

interface RenameFileDialogProps {
  open: boolean;
  file: FileMetadata | null;
  onClose: () => void;
  onRename: (fileId: string, newName: string) => Promise<void>;
  onRenamed?: () => void;
}

function validateFileName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: '文件名不能为空' };
  }
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) {
    return { valid: false, error: '文件名包含非法字符' };
  }
  if (trimmed.length > 255) {
    return { valid: false, error: '文件名过长（最大 255 字符）' };
  }
  return { valid: true };
}

export default function RenameFileDialog({
  open,
  file,
  onClose,
  onRename,
  onRenamed,
}: RenameFileDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { handleBackdropClick } = useDialog({
    open,
    onClose,
    loading,
    autoFocusRef: inputRef,
  });

  useEffect(() => {
    if (open && file) {
      setName(file.original_filename);
      setError(null);
      setTimeout(() => {
        inputRef.current?.select();
      }, 150);
    }
  }, [open, file]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!file) return;

      const trimmedName = name.trim();
      if (trimmedName === file.original_filename) {
        onClose();
        return;
      }

      const validation = validateFileName(name);
      if (!validation.valid) {
        setError(validation.error ?? '验证失败');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        await onRename(file.id, trimmedName);
        onRenamed?.();
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, '重命名失败'));
      } finally {
        setLoading(false);
      }
    },
    [name, file, onRename, onRenamed, onClose]
  );

  if (!open || !file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-sm animate-fade-in rounded-2xl bg-[#1C1C28] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-white">重命名文件</h2>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 255))}
            placeholder="请输入新名称"
            maxLength={255}
            className="mb-4 w-full rounded-lg border border-[#3A3A4D] bg-transparent px-4 py-3 text-white placeholder-gray-500 focus:border-[#6C5DD3] focus:outline-none"
            disabled={loading}
          />

          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-full bg-[#2A2A3C] py-3 text-sm font-medium text-white transition-colors hover:bg-[#3A3A4D] disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 rounded-full bg-[#6C5DD3] py-3 text-sm font-medium text-white transition-colors hover:bg-[#7C6DE3] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
