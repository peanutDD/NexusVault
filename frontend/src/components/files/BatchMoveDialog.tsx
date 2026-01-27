import { useState, useEffect } from 'react';
import { fileService } from '../../services/files';
import { folderService, type Folder } from '../../services/folders';
import { getErrorMessage } from '../../utils/error';
import ErrorMessage from '../common/ErrorMessage';
import Modal from '../common/Modal';

interface BatchMoveDialogProps {
  fileIds: string[];
  fileCount: number;
  categories: string[];
  loadingCategories: boolean;
  onClose: () => void;
  onMoved?: () => void;
}

type MoveMode = 'folder' | 'category';

export default function BatchMoveDialog({
  fileIds,
  fileCount,
  categories,
  loadingCategories,
  onClose,
  onMoved,
}: BatchMoveDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 移动模式：文件夹 or 分类
  const [mode, setMode] = useState<MoveMode>('folder');
  
  // 文件夹相关
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [targetFolderId, setTargetFolderId] = useState<string>('');
  
  // 分类相关
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [newCategory, setNewCategory] = useState('');
  const [useNewCategory, setUseNewCategory] = useState(false);

  // 加载文件夹列表
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

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'folder') {
        // 移动到文件夹
        const folderId = targetFolderId || null;
        const moved = await folderService.moveFilesToFolder(fileIds, folderId);
        const folderName = folderId 
          ? folders.find(f => f.id === folderId)?.name 
          : '根目录';
        setSuccess(`已将 ${moved} 个文件移动至「${folderName}」`);
      } else {
        // 设置分类
        const category = useNewCategory 
          ? (newCategory.trim() || null) 
          : (targetCategory.trim() || null);
        const { moved } = await fileService.batchMove(fileIds, category);
        setSuccess(`已将 ${moved} 个文件${category ? `设为「${category}」分类` : '设为未分类'}`);
      }
      onMoved?.();
    } catch (err) {
      setError(getErrorMessage(err, '操作失败'));
    } finally {
      setLoading(false);
    }
  };

  const isLoading = mode === 'folder' ? loadingFolders : loadingCategories;

  return (
    <Modal
      title="批量移动"
      description={`对 ${fileCount} 个文件执行操作`}
      onClose={onClose}
      maxWidth="sm"
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

      <form onSubmit={handleMove} className="space-y-4">
        {/* 模式切换 */}
        <div className="flex gap-2 rounded-lg bg-gray-800 p-1">
          <button
            type="button"
            onClick={() => setMode('folder')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'folder'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            移动到文件夹
          </button>
          <button
            type="button"
            onClick={() => setMode('category')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'category'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            设置分类标签
          </button>
        </div>

        {/* 文件夹选择 */}
        {mode === 'folder' && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              选择目标文件夹
            </label>
            {loadingFolders ? (
              <p className="text-sm text-gray-400">加载文件夹中…</p>
            ) : (
              <select
                aria-label="选择目标文件夹"
                value={targetFolderId}
                onChange={(e) => setTargetFolderId(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">根目录</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            {folders.length === 0 && !loadingFolders && (
              <p className="mt-2 text-xs text-gray-500">
                没有文件夹，文件将移动到根目录
              </p>
            )}
          </div>
        )}

        {/* 分类选择 */}
        {mode === 'category' && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              选择或创建分类
            </label>
            {loadingCategories ? (
              <p className="text-sm text-gray-400">加载分类中…</p>
            ) : (
              <div className="space-y-3">
                {/* 已有分类 */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-gray-300">
                    <input
                      type="radio"
                      name="categoryMode"
                      checked={!useNewCategory}
                      onChange={() => setUseNewCategory(false)}
                      className="text-purple-500 focus:ring-purple-500"
                    />
                    已有分类
                  </label>
                  <select
                    aria-label="选择已有分类"
                    value={targetCategory}
                    onChange={(e) => setTargetCategory(e.target.value)}
                    disabled={useNewCategory}
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    <option value="">未分类</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 新建分类 */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-gray-300">
                    <input
                      type="radio"
                      name="categoryMode"
                      checked={useNewCategory}
                      onChange={() => setUseNewCategory(true)}
                      className="text-purple-500 focus:ring-purple-500"
                    />
                    新建分类
                  </label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    disabled={!useNewCategory}
                    placeholder="输入新分类名称"
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading || isLoading}
            className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '处理中…' : mode === 'folder' ? '移动' : '设置分类'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
