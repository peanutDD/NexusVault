import { useState, useCallback, useEffect, useRef } from 'react';
import { folderService } from '../../services/folders';
import { getErrorMessage } from '../../utils/error';

interface CreateFolderDialogProps {
  open: boolean;
  parentId: string | null;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * 新建文件夹对话框
 */
export default function CreateFolderDialog({
  open,
  parentId,
  onClose,
  onCreated,
}: CreateFolderDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开时聚焦输入框
  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedName = name.trim();
      if (!trimmedName) {
        setError('文件夹名称不能为空');
        return;
      }

      if (trimmedName.length > 255) {
        setError('文件夹名称过长');
        return;
      }

      if (
        trimmedName.includes('/') ||
        trimmedName.includes('\\') ||
        trimmedName.includes('\0')
      ) {
        setError('文件夹名称包含非法字符');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        await folderService.create(trimmedName, parentId);
        onCreated();
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, '创建文件夹失败'));
      } finally {
        setLoading(false);
      }
    },
    [name, parentId, onCreated, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm animate-fade-in rounded-2xl bg-[#1C1C28] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-white">新建文件夹</h2>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入文件夹名称"
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
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
