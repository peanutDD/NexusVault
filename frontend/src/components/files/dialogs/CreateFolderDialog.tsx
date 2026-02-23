import { useState, useCallback, useEffect, useRef } from 'react';
import { FolderPlus } from 'lucide-react';
import { folderService } from '../../../services/folders';
import type { Folder } from '../../../types/folders';
import { getErrorMessage } from '../../../utils/error';
import { validateFolderName } from '../../../hooks/folders/useFolderValidation';
import ConfirmDialog from '../../common/dialog/ConfirmDialog';
import ErrorMessage from '../../common/feedback/ErrorMessage';

interface CreateFolderDialogProps {
  open: boolean;
  parentId: string | null;
  onClose: () => void;
  onCreated: (folder: Folder) => void;
}

/**
 * Create folder dialog
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

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 120);
    }
  }, [open]);

  const handleCreate = useCallback(async () => {
    const validation = validateFolderName(name);
    if (!validation.valid) {
      setError(validation.error ?? '验证失败');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const created = await folderService.create(name.trim(), parentId);
      onCreated(created);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, '创建文件夹失败'));
    } finally {
      setLoading(false);
    }
  }, [name, parentId, onCreated, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleCreate();
    },
    [handleCreate]
  );

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
        <p className="text-[0.65rem] uppercase tracking-[0.18em] text-white/55">文件夹名称</p>
        <form onSubmit={handleSubmit} className="mt-2">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 80))}
            placeholder="输入文件夹名称"
            maxLength={80}
            className={inputClass}
            disabled={loading}
          />
        </form>
      </div>
    </div>
  );

  return (
    <ConfirmDialog
      open={open}
      appearance="glass"
      variant="info"
      icon={<FolderPlus className="h-5 w-5" />}
      iconBgClass="bg-rose-500/15"
      iconColorClass="text-rose-300"
      title="新建文件夹"
      message={message}
      confirmText="创建"
      cancelText="取消"
      loading={loading}
      onConfirm={handleCreate}
      onCancel={onClose}
    />
  );
}
