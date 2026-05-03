import { formatFileSize } from "../../../utils/format";
import { getMimeTypeLabel } from "../../../utils/mimeType";
import { ErrorIcon, FileIcon, SpinnerIcon } from "./FilePreviewIcons";

interface PreviewFileInfo {
  original_filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export function PreviewLoadingState() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <SpinnerIcon className="h-12 w-12 text-[var(--preview-spinner)]" />
      <span className="text-sm text-[var(--preview-text-muted)]">加载中…</span>
    </div>
  );
}

export function PreviewErrorState({
  error,
  onClose,
}: {
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-2xl bg-[var(--preview-surface-soft)] px-8 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--preview-error-icon-bg)]">
        <ErrorIcon />
      </div>
      <p className="text-lg text-[var(--preview-text-primary)]">{error}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 rounded-full bg-[var(--preview-action-bg)] px-6 py-2.5 text-sm text-[var(--preview-text-primary)] transition-colors hover:bg-[var(--preview-action-bg-hover)]"
      >
        关闭
      </button>
    </div>
  );
}

export function UnsupportedPreviewState({
  file,
  formatDate,
}: {
  file: PreviewFileInfo;
  formatDate: (dateStr: string) => string;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center pointer-events-none">
      <article className="pointer-events-auto group relative rounded-md transition-colors bg-[var(--preview-unsupported-bg)] backdrop-blur-md hover:bg-[var(--preview-unsupported-hover-bg)] max-w-[min(92vw,22rem)] scale-[2]">
        <div className="p-3">
          <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-[var(--preview-unsupported-thumb-bg)]">
            <div className="flex h-full w-full items-center justify-center rounded overflow-hidden shrink-0 bg-[var(--preview-unsupported-thumb-inner-bg)]">
              <FileIcon />
            </div>
          </div>
          <div className="flex w-full items-center justify-center">
            <div className="min-w-0 flex-1 space-y-0.5 text-center">
              <p
                className="truncate whitespace-nowrap text-[clamp(7px,2vw,9px)] font-medium text-[var(--preview-text-primary)]"
                title={file.original_filename}
              >
                不支持预览
              </p>
              <p className="flex items-center justify-center gap-1 whitespace-nowrap text-[clamp(6px,1.6vw,7px)] text-[var(--preview-text-muted)]">
                <span>{formatFileSize(file.file_size)}</span>
                <span className="h-0.5 w-0.5 rounded-full bg-[var(--preview-divider)]" />
                <span>{getMimeTypeLabel(file.mime_type, file.original_filename)}</span>
              </p>
              <p className="whitespace-nowrap text-[clamp(6px,1.6vw,7px)] text-[var(--preview-text-muted)]">
                {formatDate(file.created_at)}
              </p>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
