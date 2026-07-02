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
    <div className="flex h-full w-full flex-col items-center justify-center gap-[clamp(0.78rem,1.8vw,1rem)]">
      <SpinnerIcon className="h-[clamp(2.75rem,5.4vw,3rem)] w-[clamp(2.75rem,5.4vw,3rem)] text-[var(--preview-spinner)]" />
      <span className="text-[clamp(0.75rem,1.8vw,0.875rem)] text-[var(--preview-text-muted)]">
        加载中…
      </span>
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
    <div className="neu-inset previewErrorSurface flex h-full w-full flex-col items-center justify-center gap-[clamp(0.78rem,1.8vw,1rem)] rounded-[clamp(0.8rem,2vw,1rem)] border-0 px-[clamp(1.75rem,3.6vw,2rem)] py-[clamp(2.25rem,4.5vw,2.5rem)] text-center">
      <div className="neu-raised-sm flex h-[clamp(3.75rem,7.2vw,4rem)] w-[clamp(3.75rem,7.2vw,4rem)] items-center justify-center rounded-full border-0">
        <ErrorIcon />
      </div>
      <p className="text-[clamp(1rem,2.4vw,1.125rem)] text-[var(--preview-text-primary)]">
        {error}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="neu-raised-sm previewErrorAction mt-[clamp(0.39rem,0.9vw,0.5rem)] rounded-full border-0 bg-indigo-500 px-[clamp(1.25rem,2.7vw,1.5rem)] py-[clamp(0.4875rem,1.125vw,0.625rem)] text-[clamp(0.75rem,1.8vw,0.875rem)] text-white transition-[box-shadow,color] hover:bg-indigo-600 active:shadow-[var(--neu-pressed-shadow)]"
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
      <article className="neu-raised previewUnsupportedCard pointer-events-auto group relative w-auto max-w-[var(--app-preview-unsupported-max-width)] rounded-[clamp(0.3rem,0.8vw,0.375rem)] border-0 transition-[box-shadow] scale-[2]">
        <div className="p-[clamp(0.585rem,1.35vw,0.75rem)]">
          <div className="neu-inset relative mb-[clamp(0.585rem,1.35vw,0.75rem)] aspect-square overflow-hidden rounded-[clamp(0.4rem,1vw,0.5rem)] border-0">
            <div className="flex h-full w-full items-center justify-center rounded overflow-hidden shrink-0">
              <FileIcon />
            </div>
          </div>
          <div className="flex w-full items-center justify-center">
            <div className="min-w-0 flex-1 space-y-[clamp(0.0975rem,0.3vw,0.125rem)] text-center">
              <p
                className="truncate whitespace-nowrap text-[clamp(7px,2vw,9px)] font-medium text-[var(--preview-text-primary)]"
                title={file.original_filename}
              >
                不支持预览
              </p>
              <p className="flex items-center justify-center gap-[clamp(0.195rem,0.45vw,0.25rem)] whitespace-nowrap text-[clamp(6px,1.6vw,7px)] text-[var(--preview-text-muted)]">
                <span>{formatFileSize(file.file_size)}</span>
                <span className="h-[clamp(0.0975rem,0.3vw,0.125rem)] w-[clamp(0.0975rem,0.3vw,0.125rem)] rounded-full bg-slate-500/55" />
                <span>
                  {getMimeTypeLabel(file.mime_type, file.original_filename)}
                </span>
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
