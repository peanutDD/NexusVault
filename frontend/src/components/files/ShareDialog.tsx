import { useState } from 'react';
import { shareService, type CreateShareRequest } from '../../services/shares';
import { getErrorMessage } from '../../utils/error';
import ErrorMessage from '../common/ErrorMessage';
import Modal from '../common/Modal';

interface ShareDialogProps {
  fileId: string;
  filename: string;
  onClose: () => void;
  onShareCreated?: (shareUrl: string) => void;
}

export default function ShareDialog({
  fileId,
  filename,
  onClose,
  onShareCreated,
}: ShareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateShareRequest>({
    file_id: fileId,
    password: undefined,
    expires_in_days: undefined,
    max_downloads: undefined,
  });

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data: CreateShareRequest = {
        file_id: fileId,
        password: formData.password?.trim() || undefined,
        expires_in_days: formData.expires_in_days || undefined,
        max_downloads: formData.max_downloads || undefined,
      };

      const response = await shareService.createShare(data);
      setShareUrl(response.share.url);
      onShareCreated?.(response.share.url);
    } catch (err) {
      setError(getErrorMessage(err, '创建分享链接失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      alert('链接已复制到剪贴板');
    }
  };

  return (
    <Modal title="分享文件" description={filename} onClose={onClose} maxWidth="sm">
        {error && (
          <ErrorMessage
            message={error}
            onClose={() => setError(null)}
            type="error"
          />
        )}

        {shareUrl ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                分享链接
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="share-url"
                  title="分享链接"
                  placeholder="分享链接"
                  aria-label="分享链接"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                />
                <button
                  onClick={handleCopyUrl}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  复制
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              关闭
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateShare} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                密码保护（可选）
              </label>
              <input
                type="password"
                value={formData.password || ''}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="留空则不设置密码"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                过期时间（可选，天数）
              </label>
              <input
                type="number"
                min="1"
                value={formData.expires_in_days || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    expires_in_days: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
                placeholder="留空则永不过期"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                最大下载次数（可选）
              </label>
              <input
                type="number"
                min="1"
                value={formData.max_downloads || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    max_downloads: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
                placeholder="留空则不限制"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
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
                disabled={loading}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '创建中...' : '创建分享'}
              </button>
            </div>
          </form>
        )}
    </Modal>
  );
}
