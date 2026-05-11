import { useState, useCallback, useEffect, useRef } from "react";
import { PencilLine } from "lucide-react";
import type { Folder } from "../../../types/folders";
import { getErrorMessage } from "../../../utils/error";
import { validateFolderName } from "../../../hooks/folders/useFolderValidation";
import ConfirmDialog from "../../common/dialog/ConfirmDialog";
import ErrorMessage from "../../common/feedback/ErrorMessage";

interface RenameFolderDialogProps {
  open: boolean;
  folder: Folder | null;
  onClose: () => void;
  /** 执行重命名（含乐观更新），失败会 throw */
  onRename: (folderId: string, newName: string) => Promise<void>;
  /** 重命名成功后的回调，如关闭对话框、清理状态 */
  onRenamed?: () => void;
}

/**
 * 重命名文件夹对话框
 */
export default function RenameFolderDialog({
  open,
  folder,
  onClose,
  onRename,
  onRenamed,
}: RenameFolderDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开时设置初始值
  useEffect(() => {
    if (open && folder) {
      setName(folder.name);
      setError(null);
      // 延迟选中文本
      setTimeout(() => {
        inputRef.current?.select();
      }, 150);
    }
  }, [open, folder]);

  const handleRename = useCallback(async () => {
    if (!folder) return;

    const trimmedName = name.trim();
    if (trimmedName === folder.name) {
      onClose();
      return;
    }

    const validation = validateFolderName(name);
    if (!validation.valid) {
      setError(validation.error ?? "验证失败");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onRename(folder.id, trimmedName);
      onRenamed?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "重命名失败"));
    } finally {
      setLoading(false);
    }
  }, [name, folder, onRename, onRenamed, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleRename();
    },
    [handleRename],
  );

  if (!open || !folder) return null;

  const inputClass =
    "w-full rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-field-border)] bg-transparent px-[clamp(0.4875rem,1.125vw,0.625rem)] py-[clamp(0.2925rem,0.675vw,0.375rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] text-[var(--dialog-field-text)] placeholder-[var(--dialog-field-placeholder)] focus:border-[var(--dialog-field-focus-border)] focus:outline-none";

  const message = (
    <div className="space-y-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="-wv2vqd">
      {error && (
        <ErrorMessage
          message={error}
          onClose={() => setError(null)}
          type="error"
          data-oid=".92ttl2"
        />
      )}
      <div
        className="rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-panel-border)] bg-[var(--dialog-panel-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]"
        data-oid="y9u739u"
      >
        <p
          className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
          data-oid="eu52bs9"
        >
          当前名称
        </p>
        <p
          className="mt-[clamp(0.0975rem,0.3vw,0.125rem)] font-brand text-[clamp(0.75rem,1.8vw,0.875rem)] font-normal tracking-wide text-[var(--dialog-panel-text)]"
          data-oid="68231ko"
        >
          <span className="font-semibold text-[var(--dialog-panel-accent)]" data-oid="ks9eoho">
            {folder.name}
          </span>
        </p>
      </div>
      <div data-oid="xc_-ycb">
        <p
          className="mb-[clamp(0.2925rem,0.675vw,0.375rem)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
          data-oid="ug_.i2y"
        >
          新名称
        </p>
        <div
          className="rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-list-border)] bg-[var(--dialog-list-bg)] p-[clamp(0.4875rem,1.125vw,0.625rem)]"
          data-oid="tk86h.r"
        >
          <form onSubmit={handleSubmit} data-oid="gkgdi8t">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              placeholder="输入新名称"
              maxLength={80}
              className={inputClass}
              disabled={loading}
              data-oid="ha.4hl:"
            />
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <ConfirmDialog
      open={open}
      appearance="glass"
      variant="info"
      icon={<PencilLine className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]" data-oid="r8z_ckl" />}
      iconBgClass="bg-[var(--dialog-accent-rose-bg)]"
      iconColorClass="text-[var(--dialog-accent-rose-text)]"
      title="重命名文件夹"
      message={message}
      confirmText="保存"
      cancelText="取消"
      loading={loading}
      onConfirm={handleRename}
      onCancel={onClose}
      data-oid="m.wmozj"
    />
  );
}
