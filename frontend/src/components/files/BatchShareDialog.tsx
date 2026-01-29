import { useState, useEffect } from 'react';
import { shareService, type BatchShareRequest } from '../../services/shares';
import { fileService } from '../../services/files';
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
  const [fileNames, setFileNames] = useState<string[]>([]);

  useEffect(() => {
    if (fileIds.length === 0) {
      setFileNames([]);
      return;
    }
    fileService
      .getFilesByIds(fileIds)
      .then((files) =>
        setFileNames(
          files.map((f) => (f ? f.original_filename : '')).filter(Boolean)
        )
      )
      .catch(() => setFileNames([]));
  }, [fileIds]);

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

  const inputClass =
    'w-full rounded-lg border border-[#2A2A3C] bg-transparent px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:border-[#6C5DD3] focus:outline-none';

  return (
    <Modal
      title="批量分享文件"
      description={undefined}
      onClose={onClose}
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

      {shareUrls.length > 0 ? (
        <div className="space-y-3">
          {/* 结果摘要：与上传弹窗主题一致 */}
          <div className="rounded-lg border border-[#3A3A4D] bg-[#2A2A3C] px-3 py-2">
            <p className="text-[0.65rem] uppercase tracking-wider text-gray-500">分享链接</p>
            <p className="mt-0.5 font-brand text-sm font-normal tracking-wide text-white">
              <span className="font-semibold text-[#9B8FE8]">{shareUrls.length} 个链接</span>
            </p>
          </div>

          {/* 复制链接 */}
          <div>
            <p className="mb-1.5 text-[0.65rem] uppercase tracking-wider text-gray-500">复制链接</p>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-[#3A3A4D] bg-[#2A2A3C] py-1">
              {shareUrls.map((url, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2.5 px-2.5 py-1.5"
                >
                  <input
                    id={`share-url-${index}`}
                    type="text"
                    value={url}
                    readOnly
                    title={`分享链接 ${index + 1}`}
                    className="min-w-0 flex-1 rounded border border-[#3A3A4D] bg-[#1C1C28] px-2 py-1 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(url);
                      alert('链接已复制');
                    }}
                    className="shrink-0 rounded-lg bg-[#2A2A3C] px-2 py-1 text-xs text-white transition-colors hover:bg-[#3A3A4D]"
                  >
                    复制
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCopyAllUrls}
              className="mt-2 w-full rounded-lg bg-[#6C5DD3] py-2 text-xs font-medium text-white transition-colors hover:bg-[#7C6DE3]"
            >
              复制所有链接
            </button>
          </div>

          {failedCount > 0 && (
            <p className="rounded-lg border border-[#3A3A4D] bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400">
              ⚠ {failedCount} 个文件分享失败
            </p>
          )}

          <div className="flex gap-2 pt-0.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-[#2A2A3C] py-2 text-xs font-medium text-white transition-colors hover:bg-[#3A3A4D]"
            >
              关闭
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreateShare} className="space-y-3">
          {/* 将创建分享：与上传弹窗主题一致 */}
          <div className="rounded-lg border border-[#3A3A4D] bg-[#2A2A3C] px-3 py-2">
            <p className="text-[0.65rem] uppercase tracking-wider text-gray-500">将创建分享</p>
            <p className="mt-0.5 font-brand text-sm font-normal tracking-wide text-white">
              <span className="font-semibold text-[#9B8FE8]">{fileCount} 个文件</span>
              {fileNames.length > 0 && (
                <span className="ml-1 text-gray-400">
                  （{fileNames.slice(0, 3).join('、')}
                  {fileNames.length > 3 ? ` 等${fileNames.length} 个` : ''}）
                </span>
              )}
            </p>
          </div>

          {/* 可选设置 */}
          <div>
            <p className="mb-1.5 text-[0.65rem] uppercase tracking-wider text-gray-500">可选设置</p>
            <div className="rounded-lg border border-[#3A3A4D] bg-[#2A2A3C] p-2.5 space-y-2">
              <input
                type="password"
                value={formData.password || ''}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="密码保护（可选）"
                className={inputClass}
              />
              <input
                type="number"
                min="1"
                value={formData.expires_in_days || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    expires_in_days: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="过期天数（可选，留空永不过期）"
                className={inputClass}
              />
              <input
                type="number"
                min="1"
                value={formData.max_downloads || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    max_downloads: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="最大下载次数（可选，留空不限制）"
                className={inputClass}
              />
            </div>
          </div>

          {/* 按钮行：与上传弹窗一致 */}
          <div className="flex gap-2 pt-0.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-[#2A2A3C] py-2 text-xs font-medium text-white transition-colors hover:bg-[#3A3A4D]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#6C5DD3] py-2 text-xs font-medium text-white transition-colors hover:bg-[#7C6DE3] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '创建中…' : '创建分享'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
