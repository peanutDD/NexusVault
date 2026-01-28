import { useState } from 'react';
import { shareService, type BatchShareRequest } from '../../services/shares';
import { getErrorMessage } from '../../utils/error';
import ErrorMessage from '../common/ErrorMessage';
import Modal from '../common/Modal';

interface BatchShareDialogProps {
  fileIds: string[];
  fileCount: number;
  onClose: () => void;
  onShareCreated?: () => void;
}

export default function BatchShareDialog({
  fileIds,
  fileCount,
  onClose,
  onShareCreated,
}: BatchShareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [shareUrls, setShareUrls] = useState<string[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const [formData, setFormData] = useState<Omit<BatchShareRequest, 'file_ids'>>({
    password: undefined,
    expires_in_days: undefined,
    max_downloads: undefined,
  });

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const data: BatchShareRequest = {
        file_ids: fileIds,
        password: formData.password?.trim() || undefined,
        expires_in_days: formData.expires_in_days || undefined,
        max_downloads: formData.max_downloads || undefined,
      };

      const response = await shareService.batchCreateShare(data);
      setShareUrls(response.shares.map((s) => s.url));
      setFailedCount(response.failed.length);
      setSuccess(response.message);
      onShareCreated?.();
    } catch (err) {
      setError(getErrorMessage(err, '批量创建分享链接失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAllUrls = () => {
    if (shareUrls.length > 0) {
      const urlsText = shareUrls.join('\n');
      navigator.clipboard.writeText(urlsText);
      alert(`已复制 ${shareUrls.length} 个分享链接到剪贴板`);
    }
  };

  return (
    <Modal
      title="批量分享文件"
      description={`将为 ${fileCount} 个文件创建分享链接`}
      onClose={onClose}
      maxWidth="lg"
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

        {shareUrls.length > 0 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                分享链接 ({shareUrls.length} 个)
              </label>
              <div className="max-h-60 overflow-y-auto space-y-2 mb-2">
                {shareUrls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <label htmlFor={`share-url-${index}`} className="sr-only">
                      分享链接 {index + 1}
                    </label>
                    <input
                      id={`share-url-${index}`}
                      type="text"
                      value={url}
                      readOnly
                      title={`分享链接 ${index + 1}`}
                      placeholder="分享链接"
                      className="flex-1 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        alert('链接已复制');
                      }}
                      className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:bg-white/15"
                    >
                      复制
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleCopyAllUrls}
                className="w-full rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/15"
              >
                复制所有链接
              </button>
            </div>
            {failedCount > 0 && (
              <p className="text-amber-300 text-sm">
                ⚠️ {failedCount} 个文件分享失败（可能已存在分享链接或文件不存在）
              </p>
            )}
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
                密码保护（可选，所有文件使用相同密码）
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
                {loading ? '创建中...' : '批量创建分享'}
              </button>
            </div>
          </form>
        )}
    </Modal>
  );
}
