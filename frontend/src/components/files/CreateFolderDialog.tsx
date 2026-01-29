import { useState, useCallback, useEffect, useRef } from 'react';
import { folderService, type Folder } from '../../services/folders';
import { getErrorMessage } from '../../utils/error';

interface CreateFolderDialogProps {
  open: boolean;
  parentId: string | null;
  onClose: () => void;
  onCreated: (folder: Folder) => void;
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
        const created = await folderService.create(trimmedName, parentId);
        onCreated(created);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm animate-fade-in overflow-hidden rounded-2xl border border-white/15 p-6 shadow-2xl text-white"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
          boxShadow: '0 22px 78px rgba(0,0,0,0.48), 0 0 20px rgba(168,85,247,0.15), 0 0 40px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          backdropFilter: 'blur(20px) saturate(140%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 赛博朋克玻璃高光层 */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-60"
          style={{
            background: [
              'radial-gradient(120% 70% at 15% 0%, rgba(255,255,255,0.2), transparent 60%)',
              'radial-gradient(90% 60% at 90% 10%, rgba(217,70,239,0.12), transparent 62%)',
              'radial-gradient(80% 60% at 10% 95%, rgba(16,185,129,0.1), transparent 60%)',
              'linear-gradient(0deg, transparent 0%, rgba(168,85,247,0.1) 50%, transparent 100%)',
              'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.08) 50%, transparent 100%)',
            ].join(', '),
          }}
          aria-hidden
        />
        <div className="relative z-10">
          <h2 className="mb-4 text-lg font-semibold text-white drop-shadow-sm">新建文件夹</h2>

          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入文件夹名称"
              className="mb-4 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 shadow-inner transition-colors focus:border-[#6C5DD3] focus:outline-none focus:ring-2 focus:ring-[#6C5DD3]/40"
              style={{ WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}
              disabled={loading}
            />

            {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 rounded-xl border border-white/15 bg-white/10 py-3 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 rounded-xl border border-[#6C5DD3]/40 bg-[#6C5DD3]/30 py-3 text-sm font-medium text-white transition-colors hover:bg-[#6C5DD3]/40 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ boxShadow: '0 0 20px rgba(108,93,211,0.25), inset 0 1px 0 rgba(255,255,255,0.15)' }}
              >
                {loading ? '创建中...' : '创建'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
