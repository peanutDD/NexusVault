import { CheckCircle2, RadioTower, X, Zap } from "lucide-react";
import UploadDropzone from "./UploadDropzone";
import UploadProgressList from "./UploadProgressList";
import UploadUrlForm from "./UploadUrlForm";
import { useUploadDialogController } from "./useUploadDialogController";
import "./UploadDialog.css";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

export default function UploadDialog({
  open,
  onClose,
  onUploadComplete,
}: UploadDialogProps) {
  const controller = useUploadDialogController({
    open,
    onClose,
    onUploadComplete,
  });

  if (!open) return null;

  return (
    <div
      className="uploadDialogNeuBackdrop fixed inset-x-0 bottom-0 top-[calc(clamp(4.75rem,7.6vw,6.25rem)+env(safe-area-inset-top))] z-[60] flex items-center justify-center bg-black/40 p-[clamp(0.78rem,1.8vw,1rem)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-dialog-title"
      data-oid=".7:8wip"
    >
      <div
        className="neu-raised uploadDialogNeuSurface flex w-full flex-col overflow-hidden rounded-[clamp(0.6rem,1.4vw,0.75rem)] text-[var(--upload-text)] animate-fade-in"
        data-oid="oz49qwv"
      >
        <UploadDialogHeader
          isUploading={controller.isUploading}
          onClose={controller.handleClose}
        />

        <div
          className="uploadDialogNeuBody min-h-0 flex-1 overflow-y-auto px-[clamp(1rem,2.25vw,1.25rem)] sm:px-[clamp(1.25rem,2.7vw,1.5rem)]"
          data-oid="5gs6vhm"
        >
          <UploadDropzone
            dragActive={controller.dragActive}
            onDragEnter={controller.handleDrag}
            onDragLeave={controller.handleDrag}
            onDragOver={controller.handleDrag}
            onDrop={controller.handleDrop}
            onFilesSelect={controller.appendFilesToState}
            open={open}
          />

          <UploadUrlForm onFileAdd={controller.handleUrlFileAdd} />

          <UploadProgressList
            uploadFiles={controller.uploadFiles}
            onRemoveFile={controller.handleRemove}
            onRetryFile={controller.handleRetry}
            onClearAll={controller.handleClearAll}
            maxBatchCount={controller.maxBatchCount}
            totalAtLimit={controller.totalAtLimit}
            largeAtLimit={controller.largeAtLimit}
            totalLimitWarning={controller.totalLimitWarning}
            largeLimitWarning={controller.largeLimitWarning}
            duplicateWarning={controller.duplicateWarning}
          />
        </div>

        <UploadDialogFooter
          isUploading={controller.isUploading}
          hasPending={controller.hasPending}
          hasFiles={controller.uploadFiles.length > 0}
          onCancel={controller.handleClose}
          onAttach={controller.handleAttach}
        />
      </div>
    </div>
  );
}

function UploadDialogHeader({
  isUploading,
  onClose,
}: {
  isUploading: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="uploadDialogNeuHeader flex-shrink-0 p-[clamp(1rem,2.25vw,1.25rem)] pb-[clamp(0.585rem,1.35vw,0.75rem)] sm:p-[clamp(1.25rem,2.7vw,1.5rem)] sm:pb-[clamp(0.78rem,1.8vw,1rem)]"
      data-oid="-5uz:9s"
    >
      <div
        className="flex items-start justify-between gap-[clamp(0.78rem,1.8vw,1rem)]"
        data-oid="kbqfnqy"
      >
        <div className="min-w-0" data-oid="upload-head-copy">
          <div
            className="uploadDialogNeuEyebrow mb-[clamp(0.39rem,0.9vw,0.5rem)] flex items-center gap-[clamp(0.39rem,0.9vw,0.5rem)]"
            data-oid="upload-eyebrow"
          >
            <RadioTower
              className="h-[clamp(0.6825rem,1.575vw,0.875rem)] w-[clamp(0.6825rem,1.575vw,0.875rem)]"
              aria-hidden="true"
            />
            <span>PRISM UPLINK</span>
          </div>
          <h2
            id="upload-dialog-title"
            className="font-brand uploadDialogNeuTitle truncate text-[clamp(1.125rem,2.8vw,1.25rem)] font-semibold tracking-widest text-[var(--upload-text)] sm:text-[clamp(1.25rem,3.5vw,1.5rem)]"
            data-oid="zksxhi."
          >
            Upload Files
          </h2>
          <p
            className="font-brand mt-[clamp(0.2925rem,0.675vw,0.375rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] font-normal tracking-widest text-[var(--upload-text-muted)] sm:text-[clamp(0.75rem,1.8vw,0.875rem)]"
            data-oid="oa-6jsg"
          >
            Uploaded project attachments
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isUploading}
          aria-label="关闭"
          className="neu-raised-sm uploadDialogNeuIconBtn flex h-[clamp(2rem,4.05vw,2.25rem)] w-[clamp(2rem,4.05vw,2.25rem)] shrink-0 items-center justify-center rounded-[clamp(0.4rem,1vw,0.5rem)] text-[var(--upload-text-muted)] transition-colors hover:text-[var(--upload-text)] disabled:cursor-not-allowed disabled:opacity-50"
          data-oid="nrse-xn"
        >
          <X
            className="h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]"
            aria-hidden="true"
            data-oid="2v7ndiv"
          />
        </button>
      </div>
      <div
        className="uploadDialogNeuSignal mt-[clamp(0.585rem,1.35vw,0.75rem)] text-center grid grid-cols-2 gap-[clamp(0.39rem,0.9vw,0.5rem)] sm:grid-cols-4"
        data-oid="upload-signal"
      >
        <span className="neu-raised-sm p-2">LOCAL</span>
        <span className="neu-raised-sm p-2">REMOTE</span>
        <span className="neu-raised-sm p-2">CHUNKED</span>
        <span className="neu-raised-sm p-2">INSTANT</span>
      </div>
    </div>
  );
}

function UploadDialogFooter({
  isUploading,
  hasPending,
  hasFiles,
  onCancel,
  onAttach,
}: {
  isUploading: boolean;
  hasPending: boolean;
  hasFiles: boolean;
  onCancel: () => void;
  onAttach: () => void;
}) {
  return (
    <div
      className="uploadDialogNeuFooter flex-shrink-0 p-[clamp(1rem,2.25vw,1.25rem)] pt-[clamp(0.585rem,1.35vw,0.75rem)] sm:p-[clamp(1.25rem,2.7vw,1.5rem)] sm:pt-[clamp(0.78rem,1.8vw,1rem)]"
      data-ready-to-upload={hasFiles}
      data-oid="9yo:.vp"
    >
      <div
        className="mb-[clamp(0.39rem,0.9vw,0.5rem)] flex items-center gap-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] tracking-widest text-[var(--upload-text-muted)]"
        data-oid="upload-footer-status"
      >
        {hasFiles ? (
          <CheckCircle2
            className="h-[clamp(0.6825rem,1.575vw,0.875rem)] w-[clamp(0.6825rem,1.575vw,0.875rem)] text-[var(--upload-accent)]"
            aria-hidden="true"
          />
        ) : (
          <Zap
            className="h-[clamp(0.6825rem,1.575vw,0.875rem)] w-[clamp(0.6825rem,1.575vw,0.875rem)] text-[var(--upload-accent)]"
            aria-hidden="true"
          />
        )}
        <span>{hasFiles ? "QUEUE ARMED" : "AWAITING PAYLOAD"}</span>
      </div>
      <div
        className="flex gap-[clamp(0.585rem,1.35vw,0.75rem)]"
        data-oid="3b-ji.z"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading}
          className="neu-raised-sm uploadDialogNeuSecondaryBtn uploadDialogCancelBtn font-brand flex-1 rounded-[clamp(0.4rem,1vw,0.5rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.75rem,1.8vw,0.875rem)] font-normal tracking-widest text-[var(--btn-secondary-text)] transition-[box-shadow,color] active:shadow-[var(--neu-pressed-shadow)] disabled:cursor-not-allowed disabled:opacity-50"
          data-oid="tq87jek"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAttach}
          disabled={!hasFiles || (isUploading && !hasPending)}
          className="neu-raised-sm uploadDialogNeuPrimaryBtn uploadDialogAttachBtn font-brand flex-1 rounded-[clamp(0.4rem,1vw,0.5rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.75rem,1.8vw,0.875rem)] font-normal tracking-widest text-[var(--btn-primary-text)] transition-[box-shadow,color] active:shadow-[var(--neu-pressed-shadow)] disabled:cursor-not-allowed disabled:opacity-50"
          data-oid="-49nfvp"
        >
          {hasPending
            ? "Start Upload"
            : isUploading
              ? "Uploading..."
              : "Attach files"}
        </button>
      </div>
    </div>
  );
}
