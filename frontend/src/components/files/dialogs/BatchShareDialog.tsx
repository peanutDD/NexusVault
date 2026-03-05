import { useState, useEffect } from "react";
import { shareService, type BatchShareRequest } from "../../../services/shares";
import { fileService } from "../../../services/files";
import { getErrorMessage } from "../../../utils/error";
import ErrorMessage from "../../common/feedback/ErrorMessage";
import ConfirmDialog from "../../common/dialog/ConfirmDialog";
import { Share2 } from "lucide-react";

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
  const [formData, setFormData] = useState<Omit<BatchShareRequest, "file_ids">>(
    {
      password: undefined,
      expires_in_days: undefined,
      max_downloads: undefined,
    },
  );
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
          files.map((f) => (f ? f.original_filename : "")).filter(Boolean),
        ),
      )
      .catch(() => setFileNames([]));
  }, [fileIds]);

  const handleCreateShare = async () => {
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
      setError(getErrorMessage(err, "批量创建分享链接失败"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAllUrls = () => {
    if (shareUrls.length > 0) {
      const urlsText = shareUrls.join("\n");
      navigator.clipboard.writeText(urlsText);
      alert(`已复制 ${shareUrls.length} 个分享链接到剪贴板`);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[var(--dialog-field-border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--dialog-field-text)] placeholder-[var(--dialog-field-placeholder)] focus:border-[var(--dialog-field-focus-border)] focus:outline-none";

  const message = (
    <div className="space-y-3" data-oid="-m1a102">
      {error && (
        <ErrorMessage
          message={error}
          onClose={() => setError(null)}
          type="error"
          data-oid="n.2u31t"
        />
      )}

      {success && (
        <ErrorMessage
          message={success}
          onClose={() => setSuccess(null)}
          type="info"
          data-oid="ozkq:ba"
        />
      )}

      {shareUrls.length > 0 ? (
        <div className="space-y-3" data-oid="jb5guxs">
          {/* 结果摘要 */}
          <div
            className="rounded-lg border border-[var(--dialog-panel-border)] bg-[var(--dialog-panel-bg)] px-3 py-2"
            data-oid="1i12zwm"
          >
            <p
              className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
              data-oid="6dam64j"
            >
              分享链接
            </p>
            <p
              className="mt-0.5 font-brand text-sm font-normal tracking-wide text-[var(--dialog-panel-text)]"
              data-oid="49_6q8n"
            >
              <span className="font-semibold text-[var(--dialog-panel-accent)]" data-oid="bmd6x_x">
                {shareUrls.length} 个链接
              </span>
            </p>
          </div>

          {/* 复制链接 */}
          <div data-oid="koybj05">
            <p
              className="mb-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
              data-oid="ar8f.py"
            >
              复制链接
            </p>
            <div
              className="max-h-44 overflow-y-auto rounded-lg border border-[var(--dialog-list-border)] bg-[var(--dialog-list-bg)] py-1"
              data-oid="1w66y.."
            >
              {shareUrls.map((url, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2.5 px-2.5 py-1.5"
                  data-oid="pemegm-"
                >
                  <input
                    id={`share-url-${index}`}
                    type="text"
                    value={url}
                    readOnly
                    title={`分享链接 ${index + 1}`}
                    className="min-w-0 flex-1 rounded border border-[var(--dialog-list-input-border)] bg-[var(--dialog-list-input-bg)] px-2 py-1 text-xs text-[var(--dialog-list-input-text)]"
                    data-oid="gm:6j-u"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(url);
                      alert("链接已复制");
                    }}
                    className="shrink-0 rounded-lg border border-[var(--dialog-action-border)] bg-[var(--dialog-action-bg)] px-2 py-1 text-xs text-[var(--dialog-action-text)] transition-colors hover:bg-[var(--dialog-action-hover-bg)]"
                    data-oid="9sc719o"
                  >
                    复制
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCopyAllUrls}
              className="mt-2 w-full rounded-lg border border-[var(--dialog-batch-action-border)] bg-[var(--dialog-batch-action-bg)] py-2 text-xs font-medium text-[var(--dialog-action-text)] shadow-[var(--dialog-batch-action-shadow)] transition-colors hover:brightness-110"
              data-oid="ws:fl3c"
            >
              复制所有链接
            </button>
          </div>

          {failedCount > 0 && (
            <p
              className="rounded-lg border border-[var(--dialog-warning-border)] bg-[var(--dialog-warning-bg)] px-3 py-1.5 text-xs text-[var(--dialog-warning-text)]"
              data-oid="sv:4edp"
            >
              ⚠ {failedCount} 个文件分享失败
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3" data-oid="oo9qngc">
          {/* 将创建分享 */}
          <div
            className="rounded-lg border border-[var(--dialog-panel-border)] bg-[var(--dialog-panel-bg)] px-3 py-2"
            data-oid="edys2gx"
          >
            <p
              className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
              data-oid="q623yi0"
            >
              将创建分享
            </p>
            <p
              className="mt-0.5 font-brand text-sm font-normal tracking-wide text-[var(--dialog-panel-text)]"
              data-oid="5a5nnq:"
            >
              <span className="font-semibold text-[var(--dialog-panel-accent)]" data-oid=".mib69r">
                {fileCount} 个文件
              </span>
              {fileNames.length > 0 && (
                <span className="ml-1 text-[var(--dialog-inline-text)]" data-oid="yyyc59m">
                  （{fileNames.slice(0, 3).join("、")}
                  {fileNames.length > 3 ? ` 等${fileNames.length} 个` : ""}）
                </span>
              )}
            </p>
          </div>

          {/* 可选设置 */}
          <div data-oid="::x5bx1">
            <p
              className="mb-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
              data-oid="h0t-lrs"
            >
              可选设置
            </p>
            <div
              className="space-y-2 rounded-lg border border-[var(--dialog-list-border)] bg-[var(--dialog-list-bg)] p-2.5"
              data-oid="y635gjt"
            >
              <input
                type="password"
                value={formData.password || ""}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="密码保护（可选）"
                className={inputClass}
                data-oid="lmh243m"
              />

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
                placeholder="过期天数（可选，留空永不过期）"
                className={inputClass}
                data-oid="fcru61a"
              />

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
                placeholder="最大下载次数（可选，留空不限制）"
                className={inputClass}
                data-oid="c93t__n"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ConfirmDialog
      open
      appearance="glass"
      variant="info"
      icon={<Share2 className="h-5 w-5" data-oid="hl9zp-4" />}
      iconBgClass="bg-[var(--dialog-accent-rose-bg)]"
      iconColorClass="text-[var(--dialog-accent-rose-text)]"
      title="批量分享文件"
      message={message}
      confirmText={shareUrls.length > 0 ? "关闭" : "创建分享"}
      cancelText="取消"
      loading={loading}
      onConfirm={shareUrls.length > 0 ? onClose : handleCreateShare}
      onCancel={onClose}
      data-oid="8dt6100"
    />
  );
}
