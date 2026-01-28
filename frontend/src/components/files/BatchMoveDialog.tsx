import { useState, useEffect, useMemo } from 'react';
import { folderService, type Folder } from '../../services/folders';
import { getErrorMessage } from '../../utils/error';
import { Folder as FolderIcon, FolderOpen, Home, Check, AlertCircle, Loader2, MoveRight, Files, X } from 'lucide-react';
import { cn } from '../../utils/cn';

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={() => !loading && onClose()}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-lg bg-gray-950 shadow-2xl border border-cyan-500/30"
        style={{ boxShadow: '0 0 40px rgba(6, 182, 212, 0.15), 0 0 80px rgba(236, 72, 153, 0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部霓虹边框 */}
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        
        {/* 头部 */}
        <div className="px-5 pt-5 pb-4 border-b border-cyan-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <MoveRight className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-medium text-cyan-50">批量移动</h2>
                <p className="flex items-center gap-1.5 text-sm text-cyan-400/70">
                  <Files className="h-3.5 w-3.5" />
                  已选择 {selectionText}
                </p>
              </div>
            </div>
            <button
              onClick={() => !loading && onClose()}
              className="text-gray-500 hover:text-cyan-400 transition-colors"
              title="关闭"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="px-5 py-4">
          {/* 错误提示 */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded bg-pink-500/10 px-3 py-2.5 text-sm text-pink-400 border border-pink-500/30">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 成功提示 */}
          {success && (
            <div className="mb-4 flex items-center gap-2 rounded bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-400 border border-emerald-500/30">
              <Check className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* 文件夹列表 */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-cyan-500/70">
              // 目标位置
            </label>
            
            {loadingFolders ? (
              <div className="flex items-center justify-center py-8 text-cyan-400/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm font-mono">LOADING...</span>
              </div>
            ) : (
              <div className="max-h-60 space-y-1 overflow-y-auto rounded bg-gray-900/80 p-1.5 border border-cyan-500/20">
                {/* 根目录选项 */}
                <button
                  type="button"
                  onClick={() => setTargetFolderId('')}
                  disabled={loading}
                  className={cn(
                    'flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-all',
                    targetFolderId === ''
                      ? 'bg-cyan-500/15 text-cyan-300 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]'
                      : 'text-gray-400 hover:bg-cyan-500/5 hover:text-cyan-300'
                  )}
                >
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded border transition-colors',
                    targetFolderId === '' 
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' 
                      : 'bg-gray-800 border-gray-700 text-gray-500'
                  )}>
                    <Home className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-mono">ROOT://</div>
                  </div>
                  {targetFolderId === '' && (
                    <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                  )}
                </button>

                {/* 文件夹列表 */}
                {availableFolders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setTargetFolderId(folder.id)}
                    disabled={loading}
                    className={cn(
                      'flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-all',
                      targetFolderId === folder.id
                        ? 'bg-cyan-500/15 text-cyan-300 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]'
                        : 'text-gray-400 hover:bg-cyan-500/5 hover:text-cyan-300'
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded border transition-colors',
                      targetFolderId === folder.id 
                        ? 'bg-pink-500/20 border-pink-500/50' 
                        : 'bg-gray-800 border-gray-700'
                    )}>
                      {targetFolderId === folder.id ? (
                        <FolderOpen className="h-4 w-4 text-pink-400" />
                      ) : (
                        <FolderIcon className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm">{folder.name}</div>
                    </div>
                    {targetFolderId === folder.id && (
                      <div className="h-2 w-2 rounded-full bg-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                    )}
                  </button>
                ))}

                {availableFolders.length === 0 && (
                  <div className="py-6 text-center text-sm text-gray-600 font-mono">
                    NO_FOLDERS_FOUND
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-5 py-4 border-t border-cyan-500/20 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-rose-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ boxShadow: loading ? 'none' : '0 0 20px rgba(244, 63, 94, 0.3)' }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleMove}
            disabled={loading || loadingFolders || !!success}
            className="flex flex-1 items-center justify-center gap-2 rounded bg-gradient-to-r from-cyan-600 to-cyan-500 px-4 py-2 text-sm font-medium text-gray-950 transition-all hover:from-cyan-500 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ boxShadow: loading || loadingFolders || success ? 'none' : '0 0 20px rgba(6, 182, 212, 0.4)' }}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                MOVING...
              </>
            ) : success ? (
              <>
                <Check className="h-4 w-4" />
                DONE
              </>
            ) : (
              'EXECUTE'
            )}
          </button>
        </div>

        {/* 底部霓虹边框 */}
        <div className="h-px bg-gradient-to-r from-transparent via-pink-500 to-transparent" />
      </div>
    </div>
  );
}
