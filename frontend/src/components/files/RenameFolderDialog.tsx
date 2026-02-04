import { useState, useCallback, useEffect, useRef } from 'react';
import type { Folder } from '../../types';
import { getErrorMessage } from '../../utils/error';
import { useDialog } from '../../hooks/common/useDialog';
import { validateFolderName } from '../../hooks/folders/useFolderValidation';

interface RenameFolderDialogProps {
  open: boolean;
  folder: Folder | null;
  onClose: () => void;
  /** 执行重命名（含乐观更新），失败会 throw */
  onRename: (folderId: string, newName: string) => Promise<void>;
  /** 重命名成功后的回调，如关闭对话框、清理状态 */
  onRenamed?: () => void;
}

/**
 * 重命名文件夹对话框
 */
export default function RenameFolderDialog({
  open,
  folder,
  onClose,
  onRename,
  onRenamed,
}: RenameFolderDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 使用 useDialog hook 统一处理 ESC 和聚焦
  const { handleBackdropClick } = useDialog({
    open,
    onClose,
    loading,
    autoFocusRef: inputRef,
  });

  // 打开时设置初始值
  useEffect(() => {
    if (open && folder) {
      setName(folder.name);
      setError(null);
      // 延迟选中文本
      setTimeout(() => {
        inputRef.current?.select();
      }, 150);
    }
  }, [open, folder]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!folder) return;

      const trimmedName = name.trim();
      
      // 如果名称没变，直接关闭
      if (trimmedName === folder.name) {
        onClose();
        return;
      }

      // 使用统一的验证函数
      const validation = validateFolderName(name);
      if (!validation.valid) {
        setError(validation.error ?? '验证失败');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        await onRename(folder.id, trimmedName);
        onRenamed?.();
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, '重命名失败'));
      } finally {
        setLoading(false);
      }
    },
    [name, folder, onRename, onRenamed, onClose]
  );

  if (!open || !folder) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-sm animate-fade-in rounded-2xl bg-[#1C1C28] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-white">重命名文件夹</h2>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入新名称"
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
