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
    <Modal
      title="分享文件"
      description="为这个文件创建分享链接"
      onClose={onClose}
      maxWidth="sm"
      variant="glass"
    >
        {/* 文件名（单独一行，带截断与完整 tooltip，避免撑坏容器） */}
        <div className="mb-3">
          <div className="text-xs text-gray-400 mb-1">文件</div>
          <div
            className="max-w-full truncate rounded-md bg-white/5 px-3 py-1.5 text-xs text-gray-100"
            title={filename}
          >
            {filename}
          </div>
        </div>

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
                  className="flex-1 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/15"
                >
                  复制
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/15"
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
                className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
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
                className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
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
                className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/15"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-gradient-to-r from-purple-500/70 to-fuchsia-500/60 px-4 py-2 text-white shadow-[0_12px_35px_rgba(168,85,247,0.18)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? '创建中...' : '创建分享'}
              </button>
            </div>
          </form>
        )}
    </Modal>
  );
}
