import { useState, useCallback, useEffect, useRef } from "react";
import { FolderPlus } from "lucide-react";
import { folderService } from "../../../services/folders";
import type { Folder } from "../../../types/folders";
import { getErrorMessage } from "../../../utils/error";
import { validateFolderName } from "../../../hooks/folders/useFolderValidation";
import ConfirmDialog from "../../common/dialog/ConfirmDialog";
import ErrorMessage from "../../common/feedback/ErrorMessage";

interface CreateFolderDialogProps {
  open: boolean;
  parentId: string | null;
  onClose: () => void;
  onCreated: (folder: Folder) => void;
}

/**
 * Create folder dialog
 */
export default function CreateFolderDialog({
  open,
  parentId,
  onClose,
  onCreated,
}: CreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 120);
    }
  }, [open]);

  const handleCreate = useCallback(async () => {
    const validation = validateFolderName(name);
    if (!validation.valid) {
      setError(validation.error ?? "验证失败");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const created = await folderService.create(name.trim(), parentId);
      onCreated(created);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "创建文件夹失败"));
    } finally {
      setLoading(false);
    }
  }, [name, parentId, onCreated, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleCreate();
    },
    [handleCreate],
  );

  const inputClass =
    "w-full rounded-lg border border-[var(--dialog-field-border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--dialog-field-text)] placeholder-[var(--dialog-field-placeholder)] focus:border-[var(--dialog-field-focus-border)] focus:outline-none";

  const message = (
    <div className="space-y-3" data-oid="1blbv_w">
      {error && (
        <ErrorMessage
          message={error}
          onClose={() => setError(null)}
          type="error"
          data-oid="7za6w-g"
        />
      )}
      <div
        className="rounded-lg border border-[var(--dialog-panel-border)] bg-[var(--dialog-panel-bg)] px-3 py-2"
        data-oid="4i1br7m"
      >
        <p
          className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--dialog-panel-title)]"
          data-oid="r2ncz81"
        >
          文件夹名称
        </p>
        <form onSubmit={handleSubmit} className="mt-2" data-oid="37fvisp">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 80))}
            placeholder="输入文件夹名称"
            maxLength={80}
            className={inputClass}
            disabled={loading}
            data-oid="8c7d5a7"
          />
        </form>
      </div>
    </div>
  );

  return (
    <ConfirmDialog
      open={open}
      appearance="glass"
      variant="info"
      icon={<FolderPlus className="h-5 w-5" data-oid="z8fcsjk" />}
      iconBgClass="bg-[var(--dialog-accent-rose-bg)]"
      iconColorClass="text-[var(--dialog-accent-rose-text)]"
      title="新建文件夹"
      message={message}
      confirmText="创建"
      cancelText="取消"
      loading={loading}
      onConfirm={handleCreate}
      onCancel={onClose}
      data-oid="fp7d_8b"
    />
  );
}
