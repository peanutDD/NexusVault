import { useState } from "react";
import {
  shareService,
  type CreateShareRequest,
} from "../../../services/shares";
import { getErrorMessage } from "../../../utils/error";
import ErrorMessage from "../../common/feedback/ErrorMessage";
import Modal from "../../common/dialog/Modal";

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
      setError(getErrorMessage(err, "创建分享链接失败"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      alert("链接已复制到剪贴板");
    }
  };

  return (
    <Modal
      title="分享文件"
      description="为这个文件创建分享链接"
      onClose={onClose}
      maxWidth="sm"
      variant="glass"
      data-oid="ha-3jeg"
    >
      {/* 文件名（单独一行，带截断与完整 tooltip，避免撑坏容器） */}
      <div className="mb-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="-vbx0o8">
        <div className="text-[clamp(0.68rem,1.6vw,0.75rem)] text-[var(--dialog-label-text)] mb-[clamp(0.195rem,0.45vw,0.25rem)]" data-oid="9.7-w6o">
          文件
        </div>
        <div
          className="max-w-full truncate rounded-[clamp(0.3rem,0.8vw,0.375rem)] bg-[var(--dialog-panel-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.2925rem,0.675vw,0.375rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] text-[var(--dialog-panel-text)]"
          title={filename}
          data-oid="_j-dtrm"
        >
          {filename}
        </div>
      </div>

      {error && (
        <ErrorMessage
          message={error}
          onClose={() => setError(null)}
          type="error"
          data-oid="kye358_"
        />
      )}

      {shareUrl ? (
        <div className="space-y-[clamp(0.78rem,1.8vw,1rem)]" data-oid="b3v4t29">
          <div data-oid=".gzyxg0">
            <label
              className="block text-[clamp(0.75rem,1.8vw,0.875rem)] font-medium text-[var(--dialog-label-text)] mb-[clamp(0.39rem,0.9vw,0.5rem)]"
              data-oid="65by4hc"
            >
              分享链接
            </label>
            <div className="flex gap-[clamp(0.39rem,0.9vw,0.5rem)]" data-oid="w5q63pd">
              <input
                type="text"
                id="share-url"
                title="分享链接"
                placeholder="分享链接"
                aria-label="分享链接"
                value={shareUrl}
                readOnly
                className="flex-1 rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-field-border)] bg-[var(--dialog-field-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.75rem,1.8vw,0.875rem)] text-[var(--dialog-field-text)] placeholder-[var(--dialog-field-placeholder)]"
                data-oid="qtp2-_b"
              />

              <button
                type="button"
                onClick={handleCopyUrl}
                className="rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-action-border)] bg-[var(--dialog-action-bg)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-action-text)] transition-colors hover:bg-[var(--dialog-action-hover-bg)]"
                data-oid="olsz3-y"
              >
                复制
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-action-border)] bg-[var(--dialog-action-bg)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-action-text)] transition-colors hover:bg-[var(--dialog-action-hover-bg)]"
            data-oid="1vd3adg"
          >
            关闭
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleCreateShare}
          className="space-y-[clamp(0.78rem,1.8vw,1rem)]"
          data-oid="i0fe.1p"
        >
          <div data-oid="z8-w-2:">
            <label
              className="block text-[clamp(0.75rem,1.8vw,0.875rem)] font-medium text-[var(--dialog-label-text)] mb-[clamp(0.39rem,0.9vw,0.5rem)]"
              data-oid="_sm-kis"
            >
              密码保护（可选）
            </label>
            <input
              type="password"
              value={formData.password || ""}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="留空则不设置密码"
              className="w-full rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-field-border)] bg-[var(--dialog-field-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-field-text)] placeholder-[var(--dialog-field-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--dialog-field-focus-ring)]"
              data-oid="b7c46:8"
            />
          </div>

          <div data-oid="yncw7if">
            <label
              className="block text-[clamp(0.75rem,1.8vw,0.875rem)] font-medium text-[var(--dialog-label-text)] mb-[clamp(0.39rem,0.9vw,0.5rem)]"
              data-oid="05pv7kx"
            >
              过期时间（可选，天数）
            </label>
            <input
              type="number"
              min="1"
              value={formData.expires_in_days || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expires_in_days: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
              placeholder="留空则永不过期"
              className="w-full rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-field-border)] bg-[var(--dialog-field-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-field-text)] placeholder-[var(--dialog-field-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--dialog-field-focus-ring)]"
              data-oid="_bbummf"
            />
          </div>

          <div data-oid="scllrnz">
            <label
              className="block text-[clamp(0.75rem,1.8vw,0.875rem)] font-medium text-[var(--dialog-label-text)] mb-[clamp(0.39rem,0.9vw,0.5rem)]"
              data-oid="erudwy2"
            >
              最大下载次数（可选）
            </label>
            <input
              type="number"
              min="1"
              value={formData.max_downloads || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  max_downloads: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
              placeholder="留空则不限制"
              className="w-full rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-field-border)] bg-[var(--dialog-field-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-field-text)] placeholder-[var(--dialog-field-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--dialog-field-focus-ring)]"
              data-oid=":hrr6:v"
            />
          </div>

          <div className="flex gap-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="wjdgrwk">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-action-border)] bg-[var(--dialog-action-bg)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-action-text)] transition-colors hover:bg-[var(--dialog-action-hover-bg)]"
              data-oid="swjf94z"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-[clamp(0.4rem,1vw,0.5rem)] bg-[image:var(--dialog-primary-btn-bg)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-primary-btn-text)] shadow-[var(--dialog-primary-btn-shadow)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              data-oid="swe2txq"
            >
              {loading ? "创建中..." : "创建分享"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
