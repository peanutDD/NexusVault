import { useState, useCallback, useEffect, useRef } from 'react';
import { PencilLine } from 'lucide-react';
import type { Folder } from '../../../types/folders';
import { getErrorMessage } from '../../../utils/error';
import { validateFolderName } from '../../../hooks/folders/useFolderValidation';
import ConfirmDialog from '../../common/dialog/ConfirmDialog';
import ErrorMessage from '../../common/feedback/ErrorMessage';

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

  const handleRename = useCallback(async () => {
    if (!folder) return;

    const trimmedName = name.trim();
    if (trimmedName === folder.name) {
      onClose();
      return;
    }

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
  }, [name, folder, onRename, onRenamed, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleRename();
    },
    [handleRename]
  );

  if (!open || !folder) return null;

  const inputClass =
    'w-full rounded-lg border border-white/15 bg-transparent px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:border-rose-400 focus:outline-none';

  const message = (
    <div className="space-y-3">
      {error && (
        <ErrorMessage
          message={error}
          onClose={() => setError(null)}
          type="error"
        />
      )}
      <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">
        <p className="text-[0.65rem] uppercase tracking-[0.18em] text-white/55">当前名称</p>
        <p className="mt-0.5 font-brand text-sm font-normal tracking-wide text-white">
          <span className="font-semibold text-rose-300">{folder.name}</span>
        </p>
      </div>
      <div>
        <p className="mb-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-white/55">新名称</p>
        <div className="rounded-lg border border-white/10 bg-black/35 p-2.5">
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              placeholder="输入新名称"
              maxLength={80}
              className={inputClass}
              disabled={loading}
            />
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <ConfirmDialog
      open={open}
      appearance="glass"
      variant="info"
      icon={<PencilLine className="h-5 w-5" />}
      iconBgClass="bg-rose-500/15"
      iconColorClass="text-rose-300"
      title="重命名文件夹"
      message={message}
      confirmText="保存"
      cancelText="取消"
      loading={loading}
      onConfirm={handleRename}
      onCancel={onClose}
    />
  );
}
