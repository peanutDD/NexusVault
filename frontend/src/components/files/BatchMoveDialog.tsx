import { useState } from 'react';
import { fileService } from '../../services/files';
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
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [newCategory, setNewCategory] = useState('');
  const [useNew, setUseNew] = useState(false);

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const category = useNew ? newCategory.trim() || null : (targetCategory.trim() || null);

    try {
      const { moved } = await fileService.batchMove(fileIds, category);
      setSuccess(`已将 ${moved} 个文件${category ? `移动至「${category}」` : '设为未分类'}`);
      onMoved?.();
    } catch (err) {
      setError(getErrorMessage(err, '批量移动失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="批量移动 / 分类"
      description={`将 ${fileCount} 个文件移动到目标分类`}
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
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              选择目标分类
            </label>
            {loadingCategories ? (
              <p className="text-gray-400 text-sm">加载分类中…</p>
            ) : (
              <>
                <div className="space-y-2 mb-3">
                  <label className="flex items-center gap-2 text-gray-300">
                    <input
                      type="radio"
                      name="mode"
                      checked={!useNew}
                      onChange={() => setUseNew(false)}
                    />
                    已有分类
                  </label>
                  <select
                    aria-label="选择已有分类"
                    value={targetCategory}
                    onChange={(e) => setTargetCategory(e.target.value)}
                    disabled={useNew}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    <option value="">未分类</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-gray-300">
                    <input
                      type="radio"
                      name="mode"
                      checked={useNew}
                      onChange={() => setUseNew(true)}
                    />
                    新建分类
                  </label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    disabled={!useNew}
                    placeholder="输入新分类名称"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || loadingCategories}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '移动中…' : '移动'}
            </button>
          </div>
        </form>
    </Modal>
  );
}
