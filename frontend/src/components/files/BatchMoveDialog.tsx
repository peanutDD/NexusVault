import { useState, useEffect, useMemo } from 'react';
import { folderService, type Folder } from '../../services/folders';
import { getErrorMessage } from '../../utils/error';
import { Folder as FolderIcon, FolderOpen, Home, Check, Loader2, MoveRight, Files } from 'lucide-react';
import { cn } from '../../utils/cn';
import Modal from '../common/Modal';
import ErrorMessage from '../common/ErrorMessage';

interface BatchMoveDialogProps {
  fileIds: string[];
  folderIds: string[];
  fileCount: number;
  folderCount: number;
  onClose: () => void;
  onMoved?: () => void;
}

export default function BatchMoveDialog({
  fileIds,
  folderIds,
  fileCount,
  folderCount,
  onClose,
  onMoved,
}: BatchMoveDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [targetFolderId, setTargetFolderId] = useState<string>('');

  // 过滤掉要移动的文件夹本身，不能移动到自身
  const availableFolders = useMemo(() => {
    const movingFolderSet = new Set(folderIds);
    return folders.filter(f => !movingFolderSet.has(f.id));
  }, [folders, folderIds]);

  // 构建选择描述
  const selectionText = useMemo(() => {
    const parts: string[] = [];
    if (fileCount > 0) parts.push(`${fileCount} 个文件`);
    if (folderCount > 0) parts.push(`${folderCount} 个文件夹`);
    return parts.join('、');
  }, [fileCount, folderCount]);

  useEffect(() => {
    const loadFolders = async () => {
      setLoadingFolders(true);
      try {
        const list = await folderService.list();
        setFolders(list);
      } catch {
        setFolders([]);
      } finally {
        setLoadingFolders(false);
      }
    };
    loadFolders();
  }, []);

  const handleMove = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const folderId = targetFolderId || null;
      let movedFiles = 0;
      let movedFolders = 0;

      // 移动文件
      if (fileIds.length > 0) {
        movedFiles = await folderService.moveFilesToFolder(fileIds, folderId);
      }

      // 移动文件夹
      if (folderIds.length > 0) {
        movedFolders = await folderService.moveFolders(folderIds, folderId);
      }

      const folderName = folderId 
        ? folders.find(f => f.id === folderId)?.name 
        : '根目录';
      
      const resultParts: string[] = [];
      if (movedFiles > 0) resultParts.push(`${movedFiles} 个文件`);
      if (movedFolders > 0) resultParts.push(`${movedFolders} 个文件夹`);
      
      setSuccess(`已将 ${resultParts.join('、')} 移动至「${folderName}」`);
      setTimeout(() => {
        onMoved?.();
        onClose();
      }, 1200);
    } catch (err) {
      setError(getErrorMessage(err, '移动失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, loading]);

  const handleSafeClose = () => {
    if (!loading) onClose();
  };

  return (
    <Modal
      title="批量移动"
      description={`已选择 ${selectionText}，请选择目标文件夹`}
      onClose={handleSafeClose}
      maxWidth="md"
      variant="glass"
    >
      {error && (
        <ErrorMessage
          message={error}
          onClose={() => setError(null)}
          type="error"
        />
      )}

      {success && (
        <ErrorMessage
          message={success}
          onClose={() => setSuccess(null)}
          type="info"
        />
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/85">
            <MoveRight className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Files className="h-4 w-4 text-white/70" aria-hidden="true" />
              <span className="truncate">已选择 {selectionText}</span>
            </div>
            <div className="mt-0.5 text-xs text-white/55">目标位置</div>
          </div>
        </div>

        {loadingFolders ? (
          <div className="flex items-center justify-center py-8 text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span className="ml-2 text-sm">加载文件夹…</span>
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto rounded-xl border border-white/12 bg-white/5 p-1.5">
            {/* 根目录选项 */}
            <button
              type="button"
              onClick={() => setTargetFolderId('')}
              disabled={loading}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                'border border-transparent',
                targetFolderId === ''
                  ? 'bg-white/10 text-white border-white/15'
                  : 'text-white/75 hover:bg-white/8 hover:text-white'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg border',
                  targetFolderId === '' ? 'border-white/18 bg-white/10' : 'border-white/10 bg-white/5'
                )}
              >
                <Home className="h-4 w-4 text-white/70" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm">Root</div>
              </div>
              {targetFolderId === '' && <Check className="h-4 w-4 text-emerald-200/90" aria-hidden="true" />}
            </button>

            {/* 文件夹列表 */}
            {availableFolders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setTargetFolderId(folder.id)}
                disabled={loading}
                className={cn(
                  'mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                  'border border-transparent',
                  targetFolderId === folder.id
                    ? 'bg-white/10 text-white border-white/15'
                    : 'text-white/75 hover:bg-white/8 hover:text-white'
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg border',
                    targetFolderId === folder.id ? 'border-white/18 bg-white/10' : 'border-white/10 bg-white/5'
                  )}
                >
                  {targetFolderId === folder.id ? (
                    <FolderOpen className="h-4 w-4 text-white/75" aria-hidden="true" />
                  ) : (
                    <FolderIcon className="h-4 w-4 text-white/55" aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm">{folder.name}</div>
                </div>
                {targetFolderId === folder.id && (
                  <Check className="h-4 w-4 text-emerald-200/90" aria-hidden="true" />
                )}
              </button>
            ))}

            {availableFolders.length === 0 && (
              <div className="py-6 text-center text-sm text-white/55">暂无可用文件夹</div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleSafeClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleMove}
            disabled={loading || loadingFolders || !!success}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                移动中…
              </>
            ) : success ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                完成
              </>
            ) : (
              '执行移动'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
