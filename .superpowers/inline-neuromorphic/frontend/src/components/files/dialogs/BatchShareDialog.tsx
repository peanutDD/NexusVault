import { useState, useEffect } from "react";
import { shareService, type BatchShareRequest } from "../../../services/shares";
import { fileService } from "../../../services/files";
import { getErrorMessage } from "../../../utils/error";
import { useClipboard } from "../../../hooks/useClipboard";
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
  const { copy } = useClipboard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
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
    setCopyMessage(null);

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

  const handleCopyAllUrls = async () => {
    if (shareUrls.length === 0) return;

    try {
      const urlsText = shareUrls.join("\n");
      const copied = await copy(urlsText);
      if (!copied) {
        setError("复制链接失败");
        return;
      }
      setError(null);
      setCopyMessage(`已复制 ${shareUrls.length} 个分享链接到剪贴板`);
    } catch (err) {
      setError(getErrorMessage(err, "复制链接失败"));
    }
  };

  const inputClass =
    "neu-inset w-full rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 px-[clamp(0.4875rem,1.125vw,0.625rem)] py-[clamp(0.2925rem,0.675vw,0.375rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] text-[var(--dialog-field-text)] placeholder-[var(--dialog-field-placeholder)] focus:outline-none";

  const message = (
    <div className="space-y-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="-m1a102">
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

      {copyMessage && (
        <ErrorMessage
          message={copyMessage}
          onClose={() => setCopyMessage(null)}
          type="info"
          data-oid="batch-copy-message"
        />
      )}

      {shareUrls.length > 0 ? (
        <div className="space-y-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="jb5guxs">
          {/* 结果摘要 */}
          <div
            className="neu-inset rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]"
            data-oid="1i12zwm"
          >
            <p
              className="text-[length:var(--font-size-ui-4xs)] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
              data-oid="6dam64j"
            >
              分享链接
            </p>
            <p
              className="mt-[clamp(0.0975rem,0.3vw,0.125rem)] font-brand text-[clamp(0.75rem,1.8vw,0.875rem)] font-normal tracking-wide text-[var(--dialog-panel-text)]"
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
              className="mb-[clamp(0.2925rem,0.675vw,0.375rem)] text-[length:var(--font-size-ui-4xs)] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
              data-oid="ar8f.py"
            >
              复制链接
            </p>
            <div
              className="neu-inset max-h-[clamp(10.75rem,19.8vw,11rem)] overflow-y-auto rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 py-[clamp(0.195rem,0.45vw,0.25rem)]"
              data-oid="1w66y.."
            >
              {shareUrls.map((url, index) => (
                <div
                  key={index}
                  className="flex items-center gap-[clamp(0.4875rem,1.125vw,0.625rem)] px-[clamp(0.4875rem,1.125vw,0.625rem)] py-[clamp(0.2925rem,0.675vw,0.375rem)]"
                  data-oid="pemegm-"
                >
                  <input
                    id={`share-url-${index}`}
                    type="text"
                    value={url}
                    readOnly
                    title={`分享链接 ${index + 1}`}
                    className="neu-inset min-w-0 flex-1 rounded border-0 px-[clamp(0.39rem,0.9vw,0.5rem)] py-[clamp(0.195rem,0.45vw,0.25rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] text-[var(--dialog-list-input-text)]"
                    data-oid="gm:6j-u"
                  />

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const copied = await copy(url);
                        if (!copied) {
                          setError("复制链接失败");
                          return;
                        }
                        setError(null);
                        setCopyMessage("链接已复制");
                      } catch (err) {
                        setError(getErrorMessage(err, "复制链接失败"));
                      }
                    }}
                    className="neu-raised-sm singleShareDialogAction shrink-0 rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 px-[clamp(0.39rem,0.9vw,0.5rem)] py-[clamp(0.195rem,0.45vw,0.25rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] text-[var(--dialog-action-text)] transition-[box-shadow,color] active:shadow-[var(--neu-pressed-shadow)]"
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
              className="neu-raised-sm singleShareDialogAction mt-[clamp(0.39rem,0.9vw,0.5rem)] w-full rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 py-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] font-medium text-[var(--dialog-action-text)] transition-[box-shadow,color] active:shadow-[var(--neu-pressed-shadow)]"
              data-oid="ws:fl3c"
            >
              复制所有链接
            </button>
          </div>

          {failedCount > 0 && (
            <p
              className="neu-inset rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.2925rem,0.675vw,0.375rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] text-[var(--dialog-warning-text)]"
              data-oid="sv:4edp"
            >
              ⚠ {failedCount} 个文件分享失败
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="oo9qngc">
          {/* 将创建分享 */}
          <div
            className="neu-inset rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]"
            data-oid="edys2gx"
          >
            <p
              className="text-[length:var(--font-size-ui-4xs)] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
              data-oid="q623yi0"
            >
              将创建分享
            </p>
            <p
              className="mt-[clamp(0.0975rem,0.3vw,0.125rem)] font-brand text-[clamp(0.75rem,1.8vw,0.875rem)] font-normal tracking-wide text-[var(--dialog-panel-text)]"
              data-oid="5a5nnq:"
            >
              <span className="font-semibold text-[var(--dialog-panel-accent)]" data-oid=".mib69r">
                {fileCount} 个文件
              </span>
              {fileNames.length > 0 && (
                <span className="ml-[clamp(0.195rem,0.45vw,0.25rem)] text-[var(--dialog-inline-text)]" data-oid="yyyc59m">
                  （{fileNames.slice(0, 3).join("、")}
                  {fileNames.length > 3 ? ` 等${fileNames.length} 个` : ""}）
                </span>
              )}
            </p>
          </div>

          {/* 可选设置 */}
          <div data-oid="::x5bx1">
            <p
              className="mb-[clamp(0.2925rem,0.675vw,0.375rem)] text-[length:var(--font-size-ui-4xs)] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
              data-oid="h0t-lrs"
            >
              可选设置
            </p>
            <div
              className="neu-inset space-y-[clamp(0.39rem,0.9vw,0.5rem)] rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 p-[clamp(0.4875rem,1.125vw,0.625rem)]"
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
      icon={<Share2 className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]" data-oid="hl9zp-4" />}
      iconBgClass="neu-inset"
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
