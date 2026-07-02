import { useState, useCallback, useEffect, useRef } from "react";
import { PencilLine } from "lucide-react";
import type { FileMetadata } from "../../../types/files";
import { getErrorMessage } from "../../../utils/error";
import ConfirmDialog from "../../common/dialog/ConfirmDialog";
import ErrorMessage from "../../common/feedback/ErrorMessage";

interface RenameFileDialogProps {
  open: boolean;
  file: FileMetadata | null;
  onClose: () => void;
  onRename: (fileId: string, newName: string) => Promise<void>;
  onRenamed?: () => void;
}

function validateFileName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: "文件名不能为空" };
  }
  if (
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("\0")
  ) {
    return { valid: false, error: "文件名包含非法字符" };
  }
  if (trimmed.length > 120) {
    return { valid: false, error: "文件名过长（最大 120 字符）" };
  }
  return { valid: true };
}

export default function RenameFileDialog({
  open,
  file,
  onClose,
  onRename,
  onRenamed,
}: RenameFileDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && file) {
      setName(file.original_filename);
      setError(null);
      setTimeout(() => {
        inputRef.current?.select();
      }, 150);
    }
  }, [open, file]);

  const handleRename = useCallback(async () => {
    if (!file) return;

    const trimmedName = name.trim();
    if (trimmedName === file.original_filename) {
      onClose();
      return;
    }

    const validation = validateFileName(name);
    if (!validation.valid) {
      setError(validation.error ?? "验证失败");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onRename(file.id, trimmedName);
      onRenamed?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "重命名失败"));
    } finally {
      setLoading(false);
    }
  }, [name, file, onRename, onRenamed, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleRename();
    },
    [handleRename],
  );

  if (!open || !file) return null;

  const inputClass =
    "neu-inset w-full rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 px-[clamp(0.4875rem,1.125vw,0.625rem)] py-[clamp(0.2925rem,0.675vw,0.375rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] text-[var(--dialog-field-text)] placeholder-[var(--dialog-field-placeholder)] focus:outline-none focus-visible:shadow-[var(--neu-focus-shadow)]";

  const message = (
    <div className="space-y-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="sd_-6s6">
      {error && (
        <ErrorMessage
          message={error}
          onClose={() => setError(null)}
          type="error"
          data-oid="0oorbfd"
        />
      )}
      <div
        className="neu-inset rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]"
        data-oid=".l57pri"
      >
        <p
          className="text-[length:var(--font-size-ui-4xs)] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
          data-oid="pf4xm-t"
        >
          当前名称
        </p>
        <p
          className="mt-[clamp(0.0975rem,0.3vw,0.125rem)] font-brand text-[clamp(0.75rem,1.8vw,0.875rem)] font-normal tracking-wide text-[var(--dialog-panel-text)]"
          data-oid="pg37h37"
        >
          <span className="font-semibold text-[var(--dialog-panel-accent)]" data-oid="0m8wbhc">
            {file.original_filename}
          </span>
        </p>
      </div>
      <div data-oid="cuffx5v">
        <p
          className="mb-[clamp(0.2925rem,0.675vw,0.375rem)] text-[length:var(--font-size-ui-4xs)] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
          data-oid="cb-z1sh"
        >
          新名称
        </p>
        <div
          className="neu-inset rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 p-[clamp(0.4875rem,1.125vw,0.625rem)]"
          data-oid="wyydj7i"
        >
          <form onSubmit={handleSubmit} data-oid="2c1dk6e">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 120))}
              placeholder="输入新名称"
              maxLength={120}
              className={inputClass}
              disabled={loading}
              data-oid="6pdea:x"
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
      icon={<PencilLine className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]" data-oid="rysf3zt" />}
      iconBgClass="neu-inset"
      iconColorClass="text-[var(--dialog-accent-rose-text)]"
      title="重命名文件"
      message={message}
      confirmText="保存"
      cancelText="取消"
      loading={loading}
      onConfirm={handleRename}
      onCancel={onClose}
      data-oid="8qroea:"
    />
  );
}
