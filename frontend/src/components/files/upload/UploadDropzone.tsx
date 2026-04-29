import { useRef, useCallback, useEffect } from "react";
import { cn } from "../../../utils/cn";
import { getMaxFileSizeGB } from "../../../utils/uploadValidation";

interface UploadDropzoneProps {
  /** 拖拽状态 */
  dragActive: boolean;
  /** 拖拽事件处理 */
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  /** 文件选择回调 */
  onFilesSelect: (files: File[]) => void;
  /** 对话框是否打开（用于重置 input） */
  open?: boolean;
}

/**
 * 文件拖拽区域组件
 */
export default function UploadDropzone({
  dragActive,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFilesSelect,
  open,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const maxGB = getMaxFileSizeGB();

  // 打开弹窗时清空 input
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.setAttribute("multiple", "");
    }
  }, [open]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (!list || list.length === 0) return;
      onFilesSelect(Array.from(list));
      // 清空 input 以允许重复选择相同文件
      setTimeout(() => {
        if (inputRef.current) inputRef.current.value = "";
      }, 0);
    },
    [onFilesSelect],
  );

  const handleSelectClick = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  }, []);

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "uploadDialogCyberDropzone relative mb-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition-colors duration-200",
        dragActive
          ? "uploadDialogCyberDropzoneActive border-[var(--upload-accent)] bg-[var(--upload-accent-bg)]"
          : "border-[var(--upload-drop-border)] bg-[var(--upload-drop-bg)] hover:border-[var(--upload-drop-border-hover)]",
      )}
      data-oid="_z50by4"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        aria-label="选择文件"
        onChange={handleFileChange}
        data-oid="cmzy5dv"
      />

      {/* 文件图标 - 带折角的文档样式 */}
      <div className="mb-4" data-oid="ybxiui-">
        <FileDocIcon data-oid="fk_xyyt" />
      </div>

      <p
        className="font-brand mb-1 text-sm font-normal tracking-widest text-[var(--upload-text)]"
        data-oid="rg8qpyg"
      >
        Drag and drop your files
      </p>
      <p
        className="font-brand mb-5 text-xs font-normal tracking-widest text-[var(--upload-text-muted)]"
        data-oid="-vtfj4r"
      >
        Max. File size:{" "}
        {maxGB > 1 ? `${maxGB} GB` : `${Math.round(maxGB * 1024)} MB`}
      </p>

      <button
        type="button"
        onClick={handleSelectClick}
        className="uploadDialogCyberPrimaryBtn font-brand rounded-lg bg-[var(--btn-primary-bg)] px-5 py-2.5 text-sm font-normal tracking-widest text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--btn-primary-bg-hover)]"
        data-oid="xdol0-4"
      >
        Select files
      </button>
      <p
        className="font-brand mt-2 text-xs text-[var(--upload-text-muted)]"
        data-oid="d5m9iy1"
      >
        支持多选；若多选只显示 1 个，请将多个文件
        <strong data-oid="0fhzygb">拖入上方区域</strong>
        ，或多次点击「Select files」逐个添加
      </p>
    </div>
  );
}

// 文件文档图标（带折角）
function FileDocIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-oid="fk_xyyt"
    >
      {/* 文档主体 */}
      <path
        d="M12 6C12 4.89543 12.8954 4 14 4H28L36 12V42C36 43.1046 35.1046 44 34 44H14C12.8954 44 12 43.1046 12 42V6Z"
        fill="rgb(var(--upload-doc-icon-main))"
      />

      {/* 折角 */}
      <path
        d="M28 4L36 12H30C28.8954 12 28 11.1046 28 10V4Z"
        fill="rgb(var(--upload-doc-icon-fold))"
      />
    </svg>
  );
}
