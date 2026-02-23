import { useState, useCallback, useEffect, useRef } from 'react';
import { PencilLine } from 'lucide-react';
import type { FileMetadata } from '../../../types/files';
import { getErrorMessage } from '../../../utils/error';
import ConfirmDialog from '../../common/dialog/ConfirmDialog';
import ErrorMessage from '../../common/feedback/ErrorMessage';

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
  if (trimmed.length > 120) {
    return { valid: false, error: '文件名过长（最大 120 字符）' };
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

  useEffect(() => {
    if (open && file) {
      setName(file.original_filename);
      setError(null);
      setTimeout(() => {
        inputRef.current?.select();
      }, 150);
    }
  }, [open, file]);

  const handleRename = useCallback(async () => {
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
  }, [name, file, onRename, onRenamed, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleRename();
    },
    [handleRename]
  );

  if (!open || !file) return null;

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
          <span className="font-semibold text-rose-300">{file.original_filename}</span>
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
              onChange={(e) => setName(e.target.value.slice(0, 120))}
              placeholder="输入新名称"
              maxLength={120}
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
      title="重命名文件"
      message={message}
      confirmText="保存"
      cancelText="取消"
      loading={loading}
      onConfirm={handleRename}
      onCancel={onClose}
    />
  );
}
