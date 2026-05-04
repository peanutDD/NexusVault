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
      className="uploadDialogCyberBackdrop fixed inset-0 z-50 flex items-center justify-center bg-[var(--upload-backdrop)] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-dialog-title"
      data-oid=".7:8wip"
    >
      <div
        className="uploadDialogCyberSurface flex w-full flex-col overflow-hidden rounded-xl bg-[var(--upload-surface-bg)] text-[var(--upload-text)] shadow-2xl animate-fade-in"
        data-oid="oz49qwv"
      >
        <UploadDialogHeader
          isUploading={controller.isUploading}
          onClose={controller.handleClose}
        />

        <div
          className="uploadDialogCyberBody min-h-0 flex-1 overflow-y-auto px-5 sm:px-6"
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
    <div className="uploadDialogCyberHeader flex-shrink-0 p-5 pb-3 sm:p-6 sm:pb-4" data-oid="-5uz:9s">
      <div className="flex items-start justify-between gap-4" data-oid="kbqfnqy">
        <div className="min-w-0" data-oid="upload-head-copy">
          <div className="uploadDialogCyberEyebrow mb-2 flex items-center gap-2" data-oid="upload-eyebrow">
            <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
            <span>PRISM UPLINK</span>
          </div>
          <h2
            id="upload-dialog-title"
            className="font-brand uploadDialogCyberTitle truncate text-xl font-semibold tracking-widest text-[var(--upload-text)] sm:text-2xl"
            data-oid="zksxhi."
          >
            Upload Files
          </h2>
          <p
            className="font-brand mt-1.5 text-xs font-normal tracking-widest text-[var(--upload-text-muted)] sm:text-sm"
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
          className="uploadDialogCyberIconBtn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--upload-text-muted)] transition-colors hover:bg-[var(--upload-control-hover)] hover:text-[var(--upload-text)] disabled:cursor-not-allowed disabled:opacity-50"
          data-oid="nrse-xn"
        >
          <X className="h-4 w-4" aria-hidden="true" data-oid="2v7ndiv" />
        </button>
      </div>
      <div className="uploadDialogCyberSignal mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" data-oid="upload-signal">
        <span>LOCAL</span>
        <span>REMOTE</span>
        <span>CHUNKED</span>
        <span>INSTANT</span>
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
    <div className="uploadDialogCyberFooter flex-shrink-0 p-5 pt-3 sm:p-6 sm:pt-4" data-oid="9yo:.vp">
      <div className="mb-2 flex items-center gap-2 text-xs tracking-widest text-[var(--upload-text-muted)]" data-oid="upload-footer-status">
        {hasFiles ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--upload-accent)]" aria-hidden="true" />
        ) : (
          <Zap className="h-3.5 w-3.5 text-[var(--upload-accent)]" aria-hidden="true" />
        )}
        <span>{hasFiles ? "QUEUE ARMED" : "AWAITING PAYLOAD"}</span>
      </div>
      <div className="flex gap-3" data-oid="3b-ji.z">
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading}
          className="uploadDialogCyberSecondaryBtn font-brand flex-1 rounded-lg bg-[var(--btn-secondary-bg)] px-4 py-2 text-sm font-normal tracking-widest text-[var(--btn-secondary-text)] transition-colors hover:bg-[var(--btn-secondary-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          data-oid="tq87jek"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAttach}
          disabled={!hasFiles || (isUploading && !hasPending)}
          className="uploadDialogCyberPrimaryBtn font-brand flex-1 rounded-lg bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-normal tracking-widest text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--btn-primary-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          data-oid="-49nfvp"
        >
          {hasPending ? "Start Upload" : isUploading ? "Uploading..." : "Attach files"}
        </button>
      </div>
    </div>
  );
}
