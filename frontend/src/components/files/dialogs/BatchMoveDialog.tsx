import { useState, useEffect, useMemo } from 'react';
import { folderService } from '../../../services/folders';
import type { Folder } from '../../../types';
import { getErrorMessage } from '../../../utils/error';
import { Home, Check, Loader2 } from 'lucide-react';
import { cn } from '../../../utils/cn';
import Modal from '../../common/dialog/Modal';
import ErrorMessage from '../../common/feedback/ErrorMessage';

interface BatchMoveDialogProps {
  fileIds: string[];
  folderIds: string[];
  fileCount: number;
  folderCount: number;
  onClose: () => void;
  onMoved?: () => void;
  /** 执行移动前乐观更新，返回回滚函数；失败时调用回滚 */
  onApplyOptimistic?: (
    fileIds: string[],
    folderIds: string[],
    targetFolderId: string | null
  ) => (() => void) | void;
}

export default function BatchMoveDialog({
  fileIds,
  folderIds,
  fileCount,
  folderCount,
  onClose,
  onMoved,
  onApplyOptimistic,
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

    const folderId = targetFolderId || null;
    const rollback = onApplyOptimistic?.(fileIds, folderIds, folderId);

    try {
      let movedFiles = 0;
      let movedFolders = 0;

      if (fileIds.length > 0) {
        movedFiles = await folderService.moveFilesToFolder(fileIds, folderId);
      }

      if (folderIds.length > 0) {
        movedFolders = await folderService.moveFolders(folderIds, folderId);
      }

      const anyMoved = movedFiles > 0 || movedFolders > 0;
      if (!anyMoved) {
        rollback?.();
        setError('没有项目被移动，请重试或检查目标位置。');
        return;
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
      rollback?.();
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
      description={undefined}
      onClose={handleSafeClose}
      maxWidth="sm"
      variant="upload"
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

      <div className="space-y-3">
        {/* 已选摘要：与上传弹窗主题一致 */}
        <div className="rounded-lg border border-[#3A3A4D] bg-[#2A2A3C] px-3 py-2">
          <p className="text-[0.65rem] uppercase tracking-wider text-gray-500">已选择</p>
          <p className="mt-0.5 font-brand text-sm font-normal tracking-wide text-white">
            <span className="font-semibold text-[#9B8FE8]">{selectionText}</span>
          </p>
        </div>

        {/* 目标位置：标题 + 列表 */}
        <div>
          <p className="mb-1.5 text-[0.65rem] uppercase tracking-wider text-gray-500">目标位置</p>
          {loadingFolders ? (
            <div className="flex items-center justify-center rounded-lg border border-[#3A3A4D] bg-[#2A2A3C] py-6 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="ml-2 text-xs">加载中…</span>
            </div>
          ) : (
            <div className="max-h-44 overflow-y-auto rounded-lg border border-[#3A3A4D] bg-[#2A2A3C] py-1">
              <button
                type="button"
                onClick={() => setTargetFolderId('')}
                disabled={loading}
                className={cn(
                  'flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors',
                  targetFolderId === ''
                    ? 'bg-[#6C5DD3]/20 text-white'
                    : 'text-gray-300 hover:bg-[#3A3A4D] hover:text-white'
                )}
              >
                <Home className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-xs">Root</span>
                {targetFolderId === '' && <Check className="h-3.5 w-3.5 shrink-0 text-[#9B8FE8]" aria-hidden="true" />}
              </button>
              {availableFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setTargetFolderId(folder.id)}
                  disabled={loading}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors',
                    targetFolderId === folder.id
                      ? 'bg-[#6C5DD3]/20 text-white'
                      : 'text-gray-300 hover:bg-[#3A3A4D] hover:text-white'
                  )}
                >
                  {targetFolderId === folder.id ? (
                    <i className="bi bi-folder2-open h-3.5 w-3.5 shrink-0 text-[#9B8FE8]" aria-hidden />
                  ) : (
                    <i className="bi bi-folder2 h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs">{folder.name}</span>
                  {targetFolderId === folder.id && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#9B8FE8]" aria-hidden="true" />
                  )}
                </button>
              ))}
              {availableFolders.length === 0 && (
                <p className="px-2.5 py-4 text-center text-xs text-gray-500">暂无可用文件夹</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleSafeClose}
            disabled={loading}
            className="flex-1 rounded-lg bg-[#2A2A3C] py-2 text-xs font-medium text-white transition-colors hover:bg-[#3A3A4D] disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleMove}
            disabled={loading || loadingFolders || !!success}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#6C5DD3] py-2 text-xs font-medium text-white transition-colors hover:bg-[#7C6DE3] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                移动中…
              </>
            ) : success ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
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
